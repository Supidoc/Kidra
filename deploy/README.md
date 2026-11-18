# Kidra deployment (operator guide)

How Kidra runs on Proxmox: two Debian 13 VMs, `kidra-dev` and `kidra-prod`, each
running the Kidra image with Docker Compose from `/srv/kidra`. A self-hosted
GitHub Actions runner in a small LXC deploys to them. Before every deploy, the
runner takes a Proxmox snapshot of the VM and rolls the VM back to it if the new
version does not come up healthy.

```
GitHub Actions (hosted)          Proxmox VE
  build + push image  ──►  GHCR
  deploy job  ──────────►  runner LXC (label kidra-deploy)
                               │  ssh deploy@VM (forced command kidra-deploy)
                               │  PVE API token (snapshot / rollback / start)
                               ▼
                           kidra-dev VM   kidra-prod VM   ◄── your reverse proxy (LAN/VPN)
                           /srv/kidra     /srv/kidra
```

| Path | What it is |
|---|---|
| `env/dev.env`, `env/prod.env` | Non-secret settings, shipped to `/srv/kidra/kidra.env` on each deploy |
| `vm/setup.sh` | One-time VM provisioning (Docker, deploy user, `/srv/kidra`, forced-command key) |
| `vm/kidra-deploy` | Forced-command script on the VM (`prepare`, `stop`, `up`, `start`, `status`, `logs`) |
| `ci/deploy.sh` | Runs on the runner: snapshot, deploy, health check, rollback, snapshot pruning |
| `native/kidra.service` | Hardened systemd unit for a native Linux install |
| `native/windows.md` | Native Windows install (NSSM or WinSW) |
| `proxy/nginx.conf`, `proxy/Caddyfile` | Reverse proxy configurations |

Layout on each VM:

```
/srv/kidra/
├─ compose.yaml     from the repo root, installed by each deploy
├─ kidra.env        from deploy/env/<env>.env, installed by each deploy
├─ .env             KIDRA_IMAGE=ghcr.io/<owner>/kidra@sha256:…, written by each deploy
├─ secrets.env      0600, filled in by hand, never touched by CI
├─ pb_data/         PocketBase data (uid 1000), including pb_data/backups/
└─ .staged/         files from `prepare`, waiting for `up`
```

## 1. Proxmox: create the VMs

Create both VMs from a Debian 13 cloud image. Put the disks on storage that
supports snapshots: LVM-thin, ZFS, Ceph RBD, or qcow2 on a directory/NFS
storage. Plain LVM and raw files on a directory cannot be snapshotted.

Once per cluster, build a template (replace `local-lvm` and `vmbr0` with your
storage and bridge):

```sh
cd /var/lib/vz/template
wget https://cloud.debian.org/images/cloud/trixie/latest/debian-13-genericcloud-amd64.qcow2
qm create 9013 --name debian13-cloud --ostype l26 --cores 2 --memory 3072 \
  --net0 virtio,bridge=vmbr0 --scsihw virtio-scsi-single \
  --agent enabled=1,fstrim_cloned_disks=1 --serial0 socket --vga serial0
qm set 9013 --scsi0 local-lvm:0,import-from=/var/lib/vz/template/debian-13-genericcloud-amd64.qcow2,discard=on,iothread=1
qm set 9013 --ide2 local-lvm:cloudinit --boot order=scsi0
qm template 9013
```

Then clone it per environment (2 vCPU, 3 GB RAM, 32 GB disk). The example uses
VMIDs 201 (dev) and 202 (prod):

```sh
for spec in "201 kidra-dev" "202 kidra-prod"; do
  set -- $spec
  qm clone 9013 "$1" --name "$2" --full
  qm set "$1" --cores 2 --memory 3072 --agent enabled=1 --onboot 1 \
    --ciuser debian --sshkeys /root/admin.pub --ipconfig0 ip=dhcp
  qm disk resize "$1" scsi0 32G
  qm start "$1"
done
```

Make sure **Options → QEMU Guest Agent** is enabled on both VMs
(`--agent enabled=1`). With the agent running in the guest, Proxmox freezes the
filesystems while it takes a snapshot, so snapshots are consistent. Give both VMs
a fixed IP or DHCP reservation and a DNS name (e.g. `kidra-dev.lan`,
`kidra-prod.lan`).

## 2. Proxmox: API token for deploys

The runner uses an API token that can only snapshot, roll back, start/stop and
read the two Kidra VMs. Run on any PVE node:

```sh
pveum role add KidraDeploy --privs "VM.Snapshot VM.PowerMgmt VM.Audit"
pveum user add kidra-deploy@pve --comment "Kidra CI deploys"
pveum user token add kidra-deploy@pve ci --privsep 1 --comment "GitHub runner"
#   -> prints the token secret (uuid) once; PVE_API_TOKEN is kidra-deploy@pve!ci=<uuid>

for vmid in 201 202; do
  # With privilege separation the token gets the intersection of the user's
  # and the token's permissions, so both need the ACL.
  pveum acl modify /vms/$vmid --users kidra-deploy@pve --roles KidraDeploy
  pveum acl modify /vms/$vmid --tokens 'kidra-deploy@pve!ci' --roles KidraDeploy
done
```

What the token is used for:

| API call | Privilege |
|---|---|
| `POST …/qemu/<vmid>/snapshot`, `DELETE …/snapshot/<name>` | `VM.Snapshot` |
| `POST …/snapshot/<name>/rollback` | `VM.Snapshot` (or `VM.Snapshot.Rollback`) |
| `POST …/status/start`, rollback with `start=1` | `VM.PowerMgmt` |
| `GET …/snapshot`, `GET …/status/current` | `VM.Audit` |
| `GET /nodes/<node>/tasks/<upid>/status` | none (own tasks) |

A token for dev only and another for prod only works too: create two tokens and
give each one the ACL on its VM only.

## 3. Provision each VM (`vm/setup.sh`)

Create one SSH key pair per environment for the runner (on your workstation):

```sh
ssh-keygen -t ed25519 -N '' -C kidra-ci-dev  -f kidra-ci-dev
ssh-keygen -t ed25519 -N '' -C kidra-ci-prod -f kidra-ci-prod
```

Copy `deploy/vm/` to the VM and run `setup.sh` as root with the public key:

```sh
scp -r deploy/vm debian@kidra-dev.lan:/tmp/kidra-vm
ssh debian@kidra-dev.lan sudo /tmp/kidra-vm/setup.sh "'$(cat kidra-ci-dev.pub)'"
```

`setup.sh` is idempotent: run it again after changing `kidra-deploy` or to
replace the key. It installs Docker CE and the compose plugin from Docker's apt
repository (with log rotation), installs qemu-guest-agent, creates the `deploy`
user (in the `docker` group, no password), creates `/srv/kidra`, `pb_data`
(uid 1000) and `secrets.env`, installs `/usr/local/bin/kidra-deploy`, and adds
the key to `~deploy/.ssh/authorized_keys` as

```
restrict,command="/usr/local/bin/kidra-deploy" ssh-ed25519 AAAA… kidra-ci-dev
```

That key can only run the `kidra-deploy` subcommands, with image references
pinned to `ghcr.io/<owner>/kidra@sha256:<digest>`. Because the `docker` group is
root-equivalent on the VM, this forced command is the security boundary: never
add an unrestricted key for `deploy`.

Fill in the secrets by hand on each VM:

```sh
ssh debian@kidra-dev.lan
sudo -u deploy editor /srv/kidra/secrets.env
#   KIDRA_ADMIN_EMAIL=admin@example.com
#   KIDRA_ADMIN_PASSWORD=<long random password>
```

The bootstrap migration creates the PocketBase superuser from these on the first
start. Use different credentials for dev and prod.

Record the VM host key for the `VM_KNOWN_HOSTS` secret, from the runner:

```sh
ssh-keyscan -t ed25519 kidra-dev.lan    # check the fingerprint against the VM console
```

## 4. Runner LXC

Create a small unprivileged Debian 13 LXC (1 vCPU, 512 MB–1 GB RAM, 8 GB disk).
It only runs deploy jobs; image builds run on GitHub-hosted runners. It needs
network access to the two VMs (SSH 22, HTTP 8090), the PVE API (8006) and
GitHub (HTTPS outbound). Nothing needs to reach it.

```sh
pct create 210 local:vztmpl/debian-13-standard_13.1-1_amd64.tar.zst \
  --hostname kidra-runner --unprivileged 1 --cores 1 --memory 1024 \
  --rootfs local-lvm:8 --net0 name=eth0,bridge=vmbr0,ip=dhcp --onboot 1
pct start 210 && pct enter 210
```

Inside the LXC:

```sh
apt-get update && apt-get install -y curl jq openssh-client tar ca-certificates
useradd --create-home --shell /bin/bash runner
su - runner
# Get the current version and the registration token from
# GitHub → repo → Settings → Actions → Runners → New self-hosted runner (Linux x64).
mkdir actions-runner && cd actions-runner
curl -fsSLo runner.tar.gz https://github.com/actions/runner/releases/download/v<version>/actions-runner-linux-x64-<version>.tar.gz
tar xzf runner.tar.gz
./config.sh --unattended --url https://github.com/<owner>/kidra --token <registration-token> \
  --name kidra-runner --labels kidra-deploy --no-default-labels --replace
exit
cd /home/runner/actions-runner && ./svc.sh install runner && ./svc.sh start
```

Register the runner for this repository only (not the organisation). Keep
**Settings → Actions → General → Fork pull request workflows** set to require
approval, and only run deploy jobs on `push` to `main` (and the manual
`release` dispatch from `main`), never on `pull_request`. If the PVE API uses a self-signed certificate, copy the PVE CA
(`/etc/pve/pve-root-ca.pem`) into the LXC and set `PVE_CA_FILE` for the job, or
install it with `update-ca-certificates`.

## 5. GitHub settings and environments

Repository settings:

- **Settings → Actions → General**
  - Fork pull request workflows: require approval for all outside collaborators.
  - Workflow permissions: **Read repository contents** (every job requests what it
    needs), and enable **Allow GitHub Actions to create and approve pull requests**.
    release-please opens the release PR with `GITHUB_TOKEN` and fails without it.
- **Settings → Rules → Rulesets** (or branch protection): protect `main` (no force
  pushes or deletion; changes via PR). If you require status checks, note that the
  release PR is created with `GITHUB_TOKEN`, so CI does **not** run on it automatically:
  either do not require checks for it (bypass for admins) or switch release-please to a
  GitHub App token later. No tag ruleset is needed: tags are only created by
  release-please on `main`.

Create two environments under **Settings → Environments**: `dev` and `prod`.
Restrict both to the branch `main` (Deployment branches and tags → Selected). `prod`
must allow `main`, not tags: the prod deploy runs inside the `main` workflow run (via
the reusable `release.yml`) or a manual `release` dispatch from `main`. If you like, add
required reviewers to `prod`; the release then waits for approval before deploying.

| Name | Kind | Example |
|---|---|---|
| `DEPLOY_SSH_KEY` | secret | contents of `kidra-ci-dev` (private key) |
| `VM_KNOWN_HOSTS` | secret | output of `ssh-keyscan -t ed25519 kidra-dev.lan` |
| `PVE_API_TOKEN` | secret | `kidra-deploy@pve!ci=xxxxxxxx-xxxx-xxxx-xxxx-xxxxxxxxxxxx` |
| `PVE_API_URL` | variable | `https://pve.lan:8006` |
| `PVE_NODE` | variable | `pve` |
| `VM_ID` | variable | `201` |
| `VM_HOST` | variable | `kidra-dev.lan` |

Optional variables, passed through as environment variables: `KEEP_SNAPSHOTS`
(default 5), `PVE_CA_FILE`, `PVE_INSECURE=1` (not recommended), `HEALTH_TIMEOUT`
(default 180 s), `VM_HTTP_PORT` (default 8090).

## 6. Deploying

A push to `main` deploys to dev. Merging the release-please release PR releases
`vX.Y.Z` and, after the dev deploy of that commit succeeded, deploys the same image
digest to prod (see the release process in the [README](../README.md#release-process)).
The deploy job runs:

```sh
deploy/ci/deploy.sh <env> <image@digest> <commit-sha>
```

and that does:

1. `ssh deploy@VM status`: records the running image.
2. `ssh … prepare <image>`: sends `compose.yaml` and `deploy/env/<env>.env` (as
   `kidra.env`) as a tar on stdin. The VM stages them and runs `docker pull`. The
   running app is not touched.
3. `ssh … stop`: stops the app (short downtime starts here).
4. PVE snapshot `predeploy-<YYYYmmddHHMMSS>-<digest12>` (no RAM state), then waits for the task.
5. `ssh … up <image>`: installs the staged files, writes `.env`, runs
   `docker compose up -d`, and waits for the container to report healthy.
6. Polls `http://<VM_HOST>:8090/api/health` and checks that `/api/kidra/info`
   `.commit` matches `<commit-sha>`.
7. On success, deletes `predeploy-*` snapshots beyond `KEEP_SNAPSHOTS`, oldest
   first. Other snapshots are never touched.
8. On failure in step 5 or 6: prints `status` and the last 200 log lines, rolls
   the VM back to the snapshot, starts the VM, starts the previous app, checks
   `/api/health`, and exits 1. On a fresh VM (nothing deployed yet) the rollback
   restores the empty pre-deploy state.

Use `--dry-run` to print the steps without changing anything (works without
secrets).

### Manual deploy (e.g. re-deploy an older version)

The easiest way is **Re-run jobs** on the GitHub workflow run of that version, or
for prod **Actions → release → Run workflow** (from `main`, with the tag).
From the runner LXC by hand:

```sh
cd ~/kidra && git fetch && git checkout <commit-or-tag>
export DEPLOY_SSH_KEY="$(cat ~/kidra-ci-prod)" VM_KNOWN_HOSTS="$(cat ~/kidra-prod.known_hosts)" \
  PVE_API_TOKEN='kidra-deploy@pve!ci=…' PVE_API_URL=https://pve.lan:8006 PVE_NODE=pve \
  VM_ID=202 VM_HOST=kidra-prod.lan
digest=$(docker buildx imagetools inspect ghcr.io/<owner>/kidra:v0.1.0 --format '{{json .Manifest}}' | jq -r .digest)
#   (or: skopeo inspect docker://ghcr.io/<owner>/kidra:v0.1.0 | jq -r .Digest)
deploy/ci/deploy.sh prod "ghcr.io/<owner>/kidra@$digest" "$(git rev-parse HEAD)"
```

Deploying an older version keeps the current data. Older Kidra versions must
cope with the migrations a newer version already applied; if they cannot, use a
snapshot rollback or a backup instead.

### Manual rollback to a snapshot

A rollback restores the whole VM, **including the data**: everything written
after the snapshot is lost.

```sh
qm listsnapshot 202
qm rollback 202 predeploy-20261118120000-0123456789ab --start 1
# The app was stopped when the snapshot was taken, so start it again:
ssh debian@kidra-prod.lan 'cd /srv/kidra && sudo -u deploy docker compose up -d'
```

## 7. Backups

There are three layers:

| What | Where | Retention | Restores |
|---|---|---|---|
| Pre-deploy snapshots | on the VM disk (Proxmox) | last `KEEP_SNAPSHOTS` (5) | whole VM to the state just before a deploy |
| PocketBase backups | `/srv/kidra/pb_data/backups/` (nightly 03:00, set by the bootstrap migration) | 7 | data only, from the dashboard: Settings → Backups |
| PBS backup job | Proxmox Backup Server | your PBS policy | whole VM, also after losing the host or the disk |

Snapshots live on the same disk as the VM, so they are not backups. Set up a
PBS job for both VMs after the PocketBase backup has run (Datacenter → Backup →
Add, or):

```sh
pvesh create /cluster/backup --id kidra --storage pbs --vmid 201,202 \
  --schedule "03:30" --mode snapshot --compress zstd --notes-template '{{guestname}}' \
  --prune-backups keep-daily=7,keep-weekly=4,keep-monthly=6
```

`secrets.env` is part of the PBS backup. That is acceptable for a LAN-only
setup; protect the PBS datastore accordingly. Test a restore now and then:
restore the VM backup to a new VMID with networking disconnected, start it, and
check `pb_data`.

## 8. KiCad base image updates (manual)

The `full` image is built `FROM` the official `kicad/kicad:10.0.x` image, pinned
by digest in the `Dockerfile` (`ARG KICAD_IMAGE`). Nothing bumps it
automatically, and Debian security fixes only arrive when upstream rebuilds the
image, so check for a new 10.0.x release now and then:

```sh
docker pull kicad/kicad:10.0.8
docker buildx imagetools inspect kicad/kicad:10.0.8 --format '{{json .Manifest}}' | jq -r .digest
#   or: docker inspect --format '{{index .RepoDigests 0}}' kicad/kicad:10.0.8
```

Edit the `Dockerfile`:

```dockerfile
ARG KICAD_IMAGE=kicad/kicad:10.0.8@sha256:<digest>
```

Open a PR. CI builds the image; after merging, dev gets it automatically. Check
SVG previews on dev before merging the release PR for prod. The first pull of a new
base image on the VMs is large (about 1.5–2 GB).

## 9. Troubleshooting

All `kidra-deploy` calls are logged on the VM: `journalctl -t kidra-deploy`.

| Symptom | Cause / fix |
|---|---|
| `Host key verification failed` | VM rebuilt or new IP: update `VM_KNOWN_HOSTS` (`ssh-keyscan -t ed25519 <host>`). |
| `Permission denied (publickey)` | Wrong key in `DEPLOY_SSH_KEY`, or the public key was not passed to `setup.sh`. Check `~deploy/.ssh/authorized_keys`. |
| `kidra-deploy: error: rejected command` / `invalid image reference` | Only `ghcr.io/<owner>/kidra@sha256:<64 hex>` is accepted; tags are not. |
| PVE `HTTP 401` | Token secret wrong or `PVE_API_TOKEN` not in the form `user@realm!tokenid=uuid`. |
| PVE `HTTP 403 Permission check failed` | ACL missing for the user **or** the token (with privsep both are needed), or the wrong VMID. |
| `snapshot feature is not available` | The VM disk is on storage without snapshot support; move the disk (`qm disk move`) to LVM-thin/ZFS/qcow2. |
| Snapshot task hangs or `guest-fsfreeze` errors | qemu-guest-agent not running in the VM or the option disabled: `systemctl status qemu-guest-agent`, enable the option and reboot the VM. |
| Health check times out | See the `status` and log output in the job. Check `/srv/kidra/secrets.env` syntax and that `pb_data` is owned by uid 1000 (`ls -ln /srv/kidra`). |
| `running commit is 'x', want 'y'` | The image was built from a different commit than the job passed in; check the workflow passes the commit the digest was built from. |
| App does not start after a manual `qm rollback` | The container was stopped at snapshot time: start it with `docker compose up -d` (see 6). |
| Disk full | `docker system df`; `kidra-deploy up` already removes unused image versions. Check `pb_data/backups` and Docker logs. |
| `KIDRA_APP_URL` / `KIDRA_TRUSTED_PROXY` change has no effect | These are applied to the PocketBase settings by the bootstrap migration; change them later in the dashboard (Settings). |
| Uploads fail with 413 | The reverse proxy body limit; see `proxy/` (100 MB). |
| Live updates stop working behind the proxy | Buffering on `/api/realtime` (SSE); see `proxy/`. |
