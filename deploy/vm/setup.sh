#!/usr/bin/env bash
# setup.sh: provision a fresh Debian 13 (trixie) VM for Kidra. Run as root:
#
#   sudo ./setup.sh 'ssh-ed25519 AAAA... kidra-ci-dev'
#   # or: sudo DEPLOY_PUBKEY='ssh-ed25519 AAAA...' ./setup.sh
#
# Copy the whole deploy/vm/ directory to the VM first (kidra-deploy must sit next
# to this script). Safe to run again: every step is idempotent. Without a public
# key the existing authorized_keys file is left alone.
#
# What it does:
#   - installs Docker CE + compose plugin from Docker's official apt repository
#   - configures json-file log rotation in /etc/docker/daemon.json
#   - installs and starts qemu-guest-agent (consistent snapshots via fs-freeze)
#   - creates the `deploy` user (docker group, no password, /bin/bash)
#   - creates /srv/kidra, /srv/kidra/pb_data (uid 1000) and secrets.env (0600)
#   - installs /usr/local/bin/kidra-deploy
#   - binds the CI key to the forced command in ~deploy/.ssh/authorized_keys
set -euo pipefail

KIDRA_ROOT=/srv/kidra
DEPLOY_USER=deploy
APP_UID=1000
APP_GID=1000
SCRIPT_DIR=$(cd -- "$(dirname -- "${BASH_SOURCE[0]}")" && pwd)
PUBKEY=${1:-${DEPLOY_PUBKEY:-}}

log() { printf '==> %s\n' "$*"; }
warn() { printf 'WARNING: %s\n' "$*" >&2; }
die() {
	printf 'ERROR: %s\n' "$*" >&2
	exit 1
}

[[ $(id -u) -eq 0 ]] || die "run as root"
[[ -f "$SCRIPT_DIR/kidra-deploy" ]] || die "kidra-deploy not found next to setup.sh ($SCRIPT_DIR)"

# shellcheck disable=SC1091
. /etc/os-release
[[ ${ID:-} == debian ]] || die "this script supports Debian only (found ${ID:-unknown})"
CODENAME=${VERSION_CODENAME:-trixie}
[[ $CODENAME == trixie ]] || warn "tested on Debian 13 (trixie), found $CODENAME"

if [[ -n $PUBKEY ]]; then
	[[ $PUBKEY =~ ^(ssh-ed25519|ssh-rsa|ecdsa-sha2-nistp(256|384|521)|sk-ssh-ed25519@openssh\.com|sk-ecdsa-sha2-nistp256@openssh\.com)\ [A-Za-z0-9+/=]+(\ [^\"]*)?$ ]] ||
		die "the argument does not look like a single OpenSSH public key line"
fi

export DEBIAN_FRONTEND=noninteractive

# --- base packages ----------------------------------------------------------
log "installing base packages"
apt-get update -q
apt-get install -y -q ca-certificates curl qemu-guest-agent util-linux tar

# --- Docker CE ----------------------------------------------------------------
log "configuring Docker's apt repository"
for pkg in docker.io docker-doc docker-compose podman-docker containerd runc; do
	if dpkg-query -W -f='${Status}' "$pkg" 2>/dev/null | grep -q 'install ok installed'; then
		log "removing conflicting package $pkg"
		apt-get remove -y -q "$pkg"
	fi
done
install -m 0755 -d /etc/apt/keyrings
curl -fsSL https://download.docker.com/linux/debian/gpg -o /etc/apt/keyrings/docker.asc.new
mv -f /etc/apt/keyrings/docker.asc.new /etc/apt/keyrings/docker.asc
chmod a+r /etc/apt/keyrings/docker.asc
cat >/etc/apt/sources.list.d/docker.sources <<EOF
Types: deb
URIs: https://download.docker.com/linux/debian
Suites: $CODENAME
Components: stable
Architectures: $(dpkg --print-architecture)
Signed-By: /etc/apt/keyrings/docker.asc
EOF
apt-get update -q
log "installing Docker CE"
apt-get install -y -q docker-ce docker-ce-cli containerd.io docker-buildx-plugin docker-compose-plugin

log "configuring Docker log rotation"
install -m 0755 -d /etc/docker
DAEMON_JSON='{
  "log-driver": "json-file",
  "log-opts": {
    "max-size": "10m",
    "max-file": "5"
  }
}'
if [[ ! -f /etc/docker/daemon.json ]] || [[ $(cat /etc/docker/daemon.json) != "$DAEMON_JSON" ]]; then
	[[ -f /etc/docker/daemon.json ]] && cp -a /etc/docker/daemon.json "/etc/docker/daemon.json.bak.$(date +%s)"
	printf '%s\n' "$DAEMON_JSON" >/etc/docker/daemon.json
	systemctl enable docker.service containerd.service
	systemctl restart docker.service
else
	systemctl enable --now docker.service containerd.service
fi

# --- QEMU guest agent ---------------------------------------------------------
log "enabling qemu-guest-agent"
systemctl enable qemu-guest-agent.service 2>/dev/null || true
if ! systemctl start qemu-guest-agent.service; then
	warn "qemu-guest-agent did not start. Enable 'QEMU Guest Agent' in the VM's Options in Proxmox, then reboot the VM."
fi

# --- deploy user --------------------------------------------------------------
if ! id "$DEPLOY_USER" >/dev/null 2>&1; then
	log "creating user $DEPLOY_USER"
	useradd --create-home --user-group --shell /bin/bash "$DEPLOY_USER"
fi
usermod --shell /bin/bash --append --groups docker "$DEPLOY_USER"
# '*' = no valid password, but unlike '!' sshd does not treat it as locked.
usermod --password '*' "$DEPLOY_USER"
DEPLOY_HOME=$(getent passwd "$DEPLOY_USER" | cut -d: -f6)

# --- /srv/kidra -----------------------------------------------------------------
log "creating $KIDRA_ROOT"
install -d -o "$DEPLOY_USER" -g "$DEPLOY_USER" -m 0750 "$KIDRA_ROOT"
install -d -o "$APP_UID" -g "$APP_GID" -m 0750 "$KIDRA_ROOT/pb_data"
chown "$APP_UID:$APP_GID" "$KIDRA_ROOT/pb_data"

if [[ ! -f "$KIDRA_ROOT/secrets.env" ]]; then
	log "creating $KIDRA_ROOT/secrets.env template"
	cat >"$KIDRA_ROOT/secrets.env" <<'EOF'
# Kidra secrets for this VM. Not in git, not shipped by CI. Fill in by hand:
#   sudo -u deploy editor /srv/kidra/secrets.env
# The bootstrap migration creates the PocketBase superuser from these on first
# start (an existing superuser is not changed).
#KIDRA_ADMIN_EMAIL=admin@example.com
#KIDRA_ADMIN_PASSWORD=change-me-to-a-long-random-password
EOF
fi
chown "$DEPLOY_USER:$DEPLOY_USER" "$KIDRA_ROOT/secrets.env"
chmod 0600 "$KIDRA_ROOT/secrets.env"

# --- forced-command script --------------------------------------------------------
log "installing /usr/local/bin/kidra-deploy"
install -o root -g root -m 0755 "$SCRIPT_DIR/kidra-deploy" /usr/local/bin/kidra-deploy

# --- authorized_keys ----------------------------------------------------------------
install -d -o "$DEPLOY_USER" -g "$DEPLOY_USER" -m 0700 "$DEPLOY_HOME/.ssh"
AUTH="$DEPLOY_HOME/.ssh/authorized_keys"
if [[ -n $PUBKEY ]]; then
	log "installing the CI key with forced command"
	read -r _ KEY_BLOB _ <<<"$PUBKEY"
	TMP_AUTH=$(mktemp "$DEPLOY_HOME/.ssh/authorized_keys.XXXXXX")
	trap 'rm -f -- "$TMP_AUTH"' EXIT
	if [[ -f $AUTH ]]; then
		grep -vF -- "$KEY_BLOB" "$AUTH" >"$TMP_AUTH" || true
	fi
	printf 'restrict,command="/usr/local/bin/kidra-deploy" %s\n' "$PUBKEY" >>"$TMP_AUTH"
	chown "$DEPLOY_USER:$DEPLOY_USER" "$TMP_AUTH"
	chmod 0600 "$TMP_AUTH"
	mv -f "$TMP_AUTH" "$AUTH"
elif [[ ! -f $AUTH ]]; then
	warn "no public key given; $AUTH does not exist yet. Re-run with the CI public key."
fi

log "done"
cat <<EOF

Next steps:
  1. Fill in $KIDRA_ROOT/secrets.env (KIDRA_ADMIN_EMAIL / KIDRA_ADMIN_PASSWORD).
  2. Make sure 'QEMU Guest Agent' is enabled in the VM options in Proxmox.
  3. Record the host key for the VM_KNOWN_HOSTS secret, from the runner:
       ssh-keyscan -t ed25519 <vm-host>
  4. Trigger a deploy from GitHub Actions (or run deploy/ci/deploy.sh).
EOF
