#!/usr/bin/env bash
# deploy.sh: deploy one Kidra image (pinned by digest) to a Kidra VM, with a
# Proxmox snapshot taken first and an automatic rollback if the new version fails.
# Runs on the self-hosted runner (label kidra-deploy).
#
# Usage:
#   deploy/ci/deploy.sh [--dry-run] <env> <image@digest> <commit-sha>
#     <env>           name of deploy/env/<env>.env (dev, prod)
#     <image@digest>  ghcr.io/<owner>/kidra@sha256:<64 hex>
#     <commit-sha>    commit the image was built from; must match /api/kidra/info .commit
#
# Required environment:
#   DEPLOY_SSH_KEY   private SSH key (content) for deploy@VM_HOST
#   VM_KNOWN_HOSTS   known_hosts line(s) for VM_HOST
#   PVE_API_TOKEN    user@realm!tokenid=uuid
#   PVE_API_URL      e.g. https://pve.lan:8006
#   PVE_NODE         Proxmox node that hosts the VM
#   VM_ID            numeric VMID
#   VM_HOST          hostname or IP of the VM (SSH and HTTP :8090)
# Optional environment:
#   KEEP_SNAPSHOTS   predeploy-* snapshots to keep (default 5)
#   PVE_CA_FILE      CA bundle for the PVE API certificate
#   PVE_INSECURE     1 = skip TLS verification for the PVE API (only without PVE_CA_FILE)
#   HEALTH_TIMEOUT   seconds to wait for /api/health and the commit (default 180)
#   VM_HTTP_PORT     app port on the VM (default 8090)
#   DEPLOY_SSH_USER  SSH user on the VM (default deploy)
#
# Steps: status -> prepare (tar of compose.yaml + kidra.env on stdin, docker pull)
# -> stop -> PVE snapshot predeploy-<ts>-<digest12> -> up -> health + commit check
# -> prune old snapshots. If up or the health check fails: print diagnostics,
# roll the VM back to the snapshot, start it, start the previous app, exit 1.
set -euo pipefail

SCRIPT_DIR=$(cd -- "$(dirname -- "${BASH_SOURCE[0]}")" && pwd)
REPO_ROOT=$(cd -- "$SCRIPT_DIR/../.." && pwd)
IMAGE_RE='^ghcr\.io/[a-z0-9._-]+/kidra@sha256:[0-9a-f]{64}$'

DRY_RUN=0
KEEP_SNAPSHOTS=${KEEP_SNAPSHOTS:-5}
HEALTH_TIMEOUT=${HEALTH_TIMEOUT:-180}
VM_HTTP_PORT=${VM_HTTP_PORT:-8090}
DEPLOY_SSH_USER=${DEPLOY_SSH_USER:-deploy}
PVE_INSECURE=${PVE_INSECURE:-0}
PVE_CA_FILE=${PVE_CA_FILE:-}

log() { printf '[deploy %s] %s\n' "$(date -u +%H:%M:%S)" "$*" >&2; }
die() {
	log "ERROR: $*"
	exit 1
}
group() {
	if [[ -n ${GITHUB_ACTIONS:-} ]]; then echo "::group::$*" >&2; else log "--- $*"; fi
}
endgroup() {
	if [[ -n ${GITHUB_ACTIONS:-} ]]; then echo "::endgroup::" >&2; fi
}

usage() {
	sed -n '5,10p' "$0" >&2
	exit 2
}

# --- arguments ------------------------------------------------------------------
ARGS=()
for arg in "$@"; do
	case "$arg" in
	--dry-run) DRY_RUN=1 ;;
	-h | --help) usage ;;
	-*) die "unknown option: $arg" ;;
	*) ARGS+=("$arg") ;;
	esac
done
((${#ARGS[@]} == 3)) || usage
ENV_NAME=${ARGS[0]}
IMAGE=${ARGS[1]}
COMMIT=${ARGS[2]}

[[ $ENV_NAME =~ ^[a-z0-9-]+$ ]] || die "invalid env name: $ENV_NAME"
ENV_FILE="$REPO_ROOT/deploy/env/$ENV_NAME.env"
[[ -f $ENV_FILE ]] || die "no such env file: $ENV_FILE"
[[ -f "$REPO_ROOT/compose.yaml" ]] || die "compose.yaml not found at $REPO_ROOT"
[[ $IMAGE =~ $IMAGE_RE ]] || die "invalid image (want ghcr.io/<owner>/kidra@sha256:<64 hex>): $IMAGE"
COMMIT=$(tr '[:upper:]' '[:lower:]' <<<"$COMMIT")
[[ $COMMIT =~ ^[0-9a-f]{7,40}$ ]] || die "invalid commit sha: $COMMIT"
[[ $KEEP_SNAPSHOTS =~ ^[1-9][0-9]*$ ]] || die "KEEP_SNAPSHOTS must be a number >= 1"

missing=()
for var in DEPLOY_SSH_KEY VM_KNOWN_HOSTS PVE_API_TOKEN PVE_API_URL PVE_NODE VM_ID VM_HOST; do
	[[ -n ${!var:-} ]] || missing+=("$var")
done
if ((${#missing[@]})); then
	if ((DRY_RUN)); then
		log "dry-run: missing env ${missing[*]} (using placeholders)"
		for var in "${missing[@]}"; do printf -v "$var" '<%s>' "$var"; done
	else
		die "missing environment: ${missing[*]}"
	fi
fi
if ((!DRY_RUN)); then
	[[ $VM_ID =~ ^[0-9]+$ ]] || die "VM_ID must be numeric: $VM_ID"
	[[ $PVE_API_TOKEN =~ ^[^@\ ]+@[^!\ ]+![^=\ ]+=[^\ ]+$ ]] || die "PVE_API_TOKEN must look like user@realm!tokenid=uuid"
	[[ $PVE_NODE =~ ^[A-Za-z0-9.-]+$ ]] || die "invalid PVE_NODE: $PVE_NODE"
	[[ $VM_HOST =~ ^[A-Za-z0-9.:-]+$ ]] || die "invalid VM_HOST: $VM_HOST"
fi
PVE_API_URL=${PVE_API_URL%/}

DIGEST=${IMAGE##*@sha256:}
SNAPNAME="predeploy-$(date -u +%Y%m%d%H%M%S)-${DIGEST:0:12}"
VM_PATH="/nodes/$PVE_NODE/qemu/$VM_ID"
APP_URL="http://$VM_HOST:$VM_HTTP_PORT"

# --- temp files ---------------------------------------------------------------------
WORK=$(mktemp -d)
cleanup() { rm -rf -- "$WORK"; }
trap cleanup EXIT
umask 077

printf '%s\n' "$DEPLOY_SSH_KEY" | tr -d '\r' >"$WORK/id_deploy"
printf '%s\n' "$VM_KNOWN_HOSTS" | tr -d '\r' >"$WORK/known_hosts"
printf 'Authorization: PVEAPIToken=%s\n' "$PVE_API_TOKEN" >"$WORK/pve_auth"

CURL_TLS=()
if [[ -n $PVE_CA_FILE ]]; then
	CURL_TLS=(--cacert "$PVE_CA_FILE")
elif [[ $PVE_INSECURE == 1 ]]; then
	CURL_TLS=(--insecure)
fi

# --- helpers --------------------------------------------------------------------
# ssh_vm <command...>: run a kidra-deploy subcommand on the VM (stdin is passed on).
ssh_vm() {
	if ((DRY_RUN)); then
		log "dry-run: ssh $DEPLOY_SSH_USER@$VM_HOST $*"
		[[ $1 == status ]] && printf 'image=\nstate=absent\nhealth=absent\n'
		[[ -t 0 ]] || cat >/dev/null
		return 0
	fi
	ssh -i "$WORK/id_deploy" \
		-o IdentitiesOnly=yes -o BatchMode=yes \
		-o UserKnownHostsFile="$WORK/known_hosts" -o StrictHostKeyChecking=yes \
		-o ConnectTimeout=15 -o ServerAliveInterval=15 -o ServerAliveCountMax=8 \
		-- "$DEPLOY_SSH_USER@$VM_HOST" "$*"
}

# pve <METHOD> <path> [--data-urlencode k=v ...]: call the PVE API, print the JSON body.
pve() {
	local method=$1 path=$2
	shift 2
	if ((DRY_RUN)); then
		log "dry-run: PVE $method $PVE_API_URL/api2/json$path $*"
		case "$method:$path" in
		GET:*/tasks/*) echo '{"data":{"status":"stopped","exitstatus":"OK"}}' ;;
		GET:*/snapshot) echo '{"data":[]}' ;;
		GET:*/status/current) echo '{"data":{"status":"running"}}' ;;
		*) echo '{"data":"UPID:dry-run"}' ;;
		esac
		return 0
	fi
	local out status
	out=$(curl -sS "${CURL_TLS[@]}" -H @"$WORK/pve_auth" -X "$method" \
		--connect-timeout 10 --max-time 60 -w '\n%{http_code}' \
		"$PVE_API_URL/api2/json$path" "$@") || {
		log "PVE $method $path: request failed"
		return 1
	}
	status=${out##*$'\n'}
	out=${out%$'\n'*}
	if [[ $status != 2?? ]]; then
		log "PVE $method $path: HTTP $status $out"
		return 1
	fi
	printf '%s\n' "$out"
}

# pve_wait <upid> [timeout]: wait until a PVE task stopped; fail unless exitstatus is OK.
pve_wait() {
	local upid=$1 timeout=${2:-600} deadline enc json status exitstatus
	enc=$(jq -rn --arg u "$upid" '$u|@uri')
	deadline=$((SECONDS + timeout))
	while ((SECONDS < deadline)); do
		json=$(pve GET "/nodes/$PVE_NODE/tasks/$enc/status") || json='{}'
		status=$(jq -r '.data.status // empty' <<<"$json")
		if [[ $status == stopped ]]; then
			exitstatus=$(jq -r '.data.exitstatus // empty' <<<"$json")
			if [[ $exitstatus == OK ]]; then
				return 0
			fi
			log "PVE task $upid failed: $exitstatus"
			return 1
		fi
		sleep 2
	done
	log "PVE task $upid did not finish within ${timeout}s"
	return 1
}

# pve_task <METHOD> <path> [args...]: start a PVE task and wait for it.
pve_task() {
	local json upid
	json=$(pve "$@") || return 1
	upid=$(jq -r '.data // empty' <<<"$json")
	[[ $upid == UPID:* ]] || {
		log "PVE $1 $2: no task id in response: $json"
		return 1
	}
	pve_wait "$upid"
}

# health_ok: /api/health answers 200 and /api/kidra/info reports the expected commit.
health_ok() {
	local info got
	curl -fsS --max-time 5 "$APP_URL/api/health" >/dev/null 2>&1 || return 1
	info=$(curl -fsS --max-time 5 "$APP_URL/api/kidra/info" 2>/dev/null) || return 1
	got=$(jq -r '.commit // empty' <<<"$info" 2>/dev/null | tr '[:upper:]' '[:lower:]') || return 1
	[[ -n $got ]] || return 1
	# Accept a short sha on either side (e.g. 7-char ldflags vs full sha).
	[[ $got == "$COMMIT"* || $COMMIT == "$got"* ]] && ((${#got} >= 7)) && return 0
	log "running commit is '$got', want '$COMMIT'"
	return 1
}

wait_health() {
	local deadline=$((SECONDS + HEALTH_TIMEOUT))
	if ((DRY_RUN)); then
		log "dry-run: poll $APP_URL/api/health and $APP_URL/api/kidra/info (.commit == $COMMIT)"
		return 0
	fi
	while ((SECONDS < deadline)); do
		health_ok && return 0
		sleep 3
	done
	return 1
}

wait_health_any() {
	local deadline=$((SECONDS + HEALTH_TIMEOUT))
	((DRY_RUN)) && return 0
	while ((SECONDS < deadline)); do
		curl -fsS --max-time 5 "$APP_URL/api/health" >/dev/null 2>&1 && return 0
		sleep 3
	done
	return 1
}

wait_ssh() {
	local deadline=$((SECONDS + 300))
	while ((SECONDS < deadline)); do
		ssh_vm status </dev/null >/dev/null 2>&1 && return 0
		sleep 5
	done
	return 1
}

diagnostics() {
	group "VM status"
	ssh_vm status </dev/null || true
	endgroup
	group "app logs (last 200 lines)"
	ssh_vm logs </dev/null || true
	endgroup
}

ensure_vm_running() {
	local json state
	json=$(pve GET "$VM_PATH/status/current") || return 1
	state=$(jq -r '.data.status // empty' <<<"$json")
	if [[ $state != running ]]; then
		log "VM is $state, starting it"
		pve_task POST "$VM_PATH/status/start" || return 1
	fi
}

rollback() {
	log "rolling back VM $VM_ID to snapshot $SNAPNAME"
	if ! pve_task POST "$VM_PATH/snapshot/$SNAPNAME/rollback" --data-urlencode start=1; then
		log "rollback with start=1 failed, retrying without it"
		pve_task POST "$VM_PATH/snapshot/$SNAPNAME/rollback" || die "ROLLBACK FAILED: VM $VM_ID needs manual attention"
	fi
	ensure_vm_running || die "could not start VM $VM_ID after rollback"
	log "waiting for SSH on $VM_HOST"
	wait_ssh || die "VM $VM_HOST not reachable over SSH after rollback"
	if [[ -n $PREV_IMAGE ]]; then
		log "starting the previous app ($PREV_IMAGE)"
		ssh_vm start </dev/null || log "starting the previous app failed"
		if wait_health_any; then
			log "rollback OK: previous version is healthy"
		else
			log "rollback done, but the previous version is NOT healthy"
		fi
	else
		log "rollback OK: VM restored to its pre-deploy state (no app was deployed before)"
	fi
	group "VM status after rollback"
	ssh_vm status </dev/null || true
	endgroup
}

prune_snapshots() {
	local json names count n
	json=$(pve GET "$VM_PATH/snapshot") || {
		log "could not list snapshots, skipping prune"
		return 0
	}
	mapfile -t names < <(jq -r '[.data[] | select(.name | startswith("predeploy-"))]
		| sort_by(.snaptime // 0, .name) | .[].name' <<<"$json")
	count=${#names[@]}
	if ((count <= KEEP_SNAPSHOTS)); then
		log "$count predeploy snapshot(s), keeping all (KEEP_SNAPSHOTS=$KEEP_SNAPSHOTS)"
		return 0
	fi
	for n in "${names[@]:0:count-KEEP_SNAPSHOTS}"; do
		log "deleting old snapshot $n"
		pve_task DELETE "$VM_PATH/snapshot/$n" || log "could not delete snapshot $n"
	done
}

# --- deploy ---------------------------------------------------------------------
log "deploying $IMAGE (commit $COMMIT) to env '$ENV_NAME' (VM $VM_ID on $PVE_NODE, host $VM_HOST)"
((DRY_RUN)) && log "DRY RUN: nothing is changed"

group "current status"
STATUS=$(ssh_vm status </dev/null) || die "cannot reach $DEPLOY_SSH_USER@$VM_HOST"
printf '%s\n' "$STATUS" >&2
PREV_IMAGE=$(sed -n 's/^image=//p' <<<"$STATUS")
endgroup

group "prepare"
mkdir "$WORK/bundle"
cp "$REPO_ROOT/compose.yaml" "$WORK/bundle/compose.yaml"
cp "$ENV_FILE" "$WORK/bundle/kidra.env"
chmod 0644 "$WORK/bundle/compose.yaml" "$WORK/bundle/kidra.env"
tar -C "$WORK/bundle" --owner=0 --group=0 --numeric-owner -cf "$WORK/bundle.tar" compose.yaml kidra.env
((DRY_RUN)) && tar -tvf "$WORK/bundle.tar" >&2
ssh_vm prepare "$IMAGE" <"$WORK/bundle.tar" || die "prepare failed (the running app was not touched)"
endgroup

group "stop"
if ! ssh_vm stop </dev/null; then
	ssh_vm start </dev/null || true
	die "stop failed"
fi
endgroup

group "snapshot $SNAPNAME"
if ! pve_task POST "$VM_PATH/snapshot" \
	--data-urlencode "snapname=$SNAPNAME" \
	--data-urlencode vmstate=0 \
	--data-urlencode "description=kidra pre-deploy env=$ENV_NAME commit=$COMMIT image=$IMAGE previous=${PREV_IMAGE:-none}"; then
	log "snapshot failed, restarting the previous app"
	ssh_vm start </dev/null || true
	die "snapshot failed; nothing deployed"
fi
endgroup

group "up"
ok=1
if ! ssh_vm up "$IMAGE" </dev/null; then
	log "up failed"
	ok=0
fi
if ((ok)); then
	log "waiting for $APP_URL/api/health and commit $COMMIT (timeout ${HEALTH_TIMEOUT}s)"
	if ! wait_health; then
		log "health check failed"
		ok=0
	fi
fi
endgroup

if ((!ok)); then
	diagnostics
	rollback
	die "deploy of $IMAGE failed; rolled back to $SNAPNAME"
fi

log "deploy OK: $IMAGE is healthy and runs commit $COMMIT"
group "prune snapshots"
prune_snapshots
endgroup
log "done"
