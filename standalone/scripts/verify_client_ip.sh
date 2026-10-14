#!/usr/bin/env bash
# Verifies the client IP the standalone backend sees (#384). Run from the
# repo root:
#
#   standalone/scripts/verify_client_ip.sh [probe|reach|e2e]
#
# Modes:
#   probe (default)  Repeats the #371 measurement. Starts VAULT_IMAGE (Sysbox
#                    or --privileged) with the inner stack in
#                    standalone/scripts/verify_client_ip/, a probe service
#                    published like Tent (ports: ["80:80"]) that answers with
#                    the source address of its socket. The Vault container is
#                    published on BIND:PORT:80. The script requests it from
#                    this host (127.0.0.1, plus every non-loopback address
#                    when BIND=0.0.0.0) and reports the address the probe saw,
#                    i.e. the address the backend would see.
#   reach            Starts the same probe on 127.0.0.1:PORT and checks
#                    whether each of this host's non-loopback addresses can
#                    reach the port (it should not). Prints the commands a
#                    second LAN machine runs for the moby#45610 check.
#   e2e              No container management. POSTs /auth/status.json on
#                    BASE_URL without cookies and reports loggedIn, the user
#                    (from the access_token cookie), isAdmin and the
#                    kerghan-standalone image of the running instance.
#
# Every mode prints one report block on stdout (progress goes to stderr):
# paste it back into the issue or PR. Only docker and curl are used; nothing
# is installed. probe and reach always remove their container and volume.
#
# Env inputs (all optional):
#   MODE           mode when no argument is given     (default probe)
#   VAULT_IMAGE    Vault image for probe/reach        (default darthjee/vault:0.1.0)
#   RUNTIME        auto | sysbox | privileged         (default auto: Sysbox
#                  when the daemon has sysbox-runc, else --privileged)
#   BIND           host address for probe             (default 127.0.0.1;
#                  reach always uses 127.0.0.1)
#   PORT           host port for probe/reach          (default 3090)
#   HOLD           true to keep the probe up until Ctrl-C after the report,
#                  so a LAN machine can run its checks (default false)
#   LAN_IP         this host's LAN address used in the LAN commands
#                  (default: the first non-loopback, non-Docker address)
#   PROBE_TIMEOUT  seconds to wait for the probe      (default 180)
#   ALLOWED_IPS    allowlist the seen address is checked against (default:
#                  DEFAULT_USER_ALLOWED_IPS from standalone/bin/kerghan)
#   KERGHAN_HOME   client folder for e2e              (default ~/.kerghan)
#   BASE_URL       e2e URL (default http://localhost:<port>, the port from
#                  KERGHAN_HOME/config, or 3000)
#   KERGHAN_CONTAINER  instance container for e2e     (default vault-kerghan)
#   EXPECT_LOGGED_IN   e2e expectation, true | false  (default true)
#   EXPECT_USER    e2e expected user when logged in   (default admin)
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROBE_DIR="$SCRIPT_DIR/verify_client_ip"
CLIENT="$SCRIPT_DIR/../bin/kerghan"

MODE="${1:-${MODE:-probe}}"
VAULT_IMAGE="${VAULT_IMAGE:-darthjee/vault:0.1.0}"
RUNTIME="${RUNTIME:-auto}"
BIND="${BIND:-127.0.0.1}"
PORT="${PORT:-3090}"
HOLD="${HOLD:-false}"
LAN_IP="${LAN_IP:-}"
PROBE_TIMEOUT="${PROBE_TIMEOUT:-180}"
ALLOWED_IPS="${ALLOWED_IPS:-}"
KERGHAN_HOME="${KERGHAN_HOME:-$HOME/.kerghan}"
BASE_URL="${BASE_URL:-}"
KERGHAN_CONTAINER="${KERGHAN_CONTAINER:-vault-kerghan}"
EXPECT_LOGGED_IN="${EXPECT_LOGGED_IN:-true}"
EXPECT_USER="${EXPECT_USER:-admin}"

RUN_ID="$$-$(date +%s)"
CONTAINER="kerghan-verify-ip-$RUN_ID"
VOLUME="kerghan-verify-ip-data-$RUN_ID"
STARTED=false
SUCCESS=false
REPORT=()

log() {
  printf '[verify-ip] %s\n' "$*" >&2
}

fail() {
  printf '[verify-ip] FAILED: %s\n' "$*" >&2
  exit 1
}

cleanup() {
  if [ "$STARTED" = "true" ]; then
    if [ "$SUCCESS" != "true" ] && docker container inspect "$CONTAINER" >/dev/null 2>&1; then
      log "last container logs:"
      docker logs --tail 50 "$CONTAINER" >&2 2>&1 || true
    fi
    docker rm -f "$CONTAINER" >/dev/null 2>&1 || true
    docker volume rm -f "$VOLUME" >/dev/null 2>&1 || true
  fi
}
trap cleanup EXIT
trap 'exit 130' INT TERM

usage() {
  sed -n '2,/^set -euo pipefail$/p' "${BASH_SOURCE[0]}" | sed -e '$d' -e 's/^# \{0,1\}//'
}

# report <line> - adds a line to the report block.
report() {
  REPORT+=("$*")
}

print_report() {
  local line
  printf '%s\n' "----- BEGIN kerghan client-IP report (#384) -----"
  for line in "${REPORT[@]}"; do
    printf '%s\n' "$line"
  done
  printf '%s\n' "----- END kerghan client-IP report -----"
}

# docker_or <fallback> <docker args...> - prints the docker output, or the
# fallback when docker is missing or the call fails.
docker_or() {
  local fallback="$1" out
  shift
  if out=$(docker "$@" 2>/dev/null) && [ -n "$out" ]; then
    printf '%s\n' "$out"
  else
    printf '%s\n' "$fallback"
  fi
}

docker_kind() {
  local os
  os=$(docker_or "" info --format '{{.OperatingSystem}}')
  case "$os" in
    "") echo "unavailable" ;;
    *"Docker Desktop"*) echo "Docker Desktop ($os)" ;;
    *) echo "native ($os)" ;;
  esac
}

report_environment() {
  report "mode: $MODE"
  report "date: $(date -u +%Y-%m-%dT%H:%M:%SZ)"
  report "platform: $(uname -sm)"
  report "docker engine: $(docker_or unavailable version --format '{{.Server.Version}}')"
  report "docker: $(docker_kind)"
}

is_ipv4() {
  local IFS=. part parts
  [[ "$1" =~ ^[0-9]{1,3}(\.[0-9]{1,3}){3}$ ]] || return 1
  read -r -a parts <<<"$1"
  for part in "${parts[@]}"; do
    [ "$part" -le 255 ] || return 1
  done
}

ipv4_to_int() {
  local IFS=.
  # shellcheck disable=SC2086
  set -- $1
  echo $(( ($1 << 24) + ($2 << 16) + ($3 << 8) + $4 ))
}

# in_allowlist <address> - succeeds when the address matches an ALLOWED_IPS
# entry (exact address, or an IPv4 CIDR).
in_allowlist() {
  local addr="$1" entry net prefix mask
  local IFS=,
  for entry in $ALLOWED_IPS; do
    if [ "$entry" = "$addr" ]; then
      return 0
    fi
    case "$entry" in
      */*)
        net="${entry%/*}"
        prefix="${entry#*/}"
        if ! is_ipv4 "$addr" || ! is_ipv4 "$net"; then
          continue
        fi
        mask=$(( (0xFFFFFFFF << (32 - prefix)) & 0xFFFFFFFF ))
        if [ $(( $(ipv4_to_int "$addr") & mask )) -eq $(( $(ipv4_to_int "$net") & mask )) ]; then
          return 0
        fi
        ;;
    esac
  done
  return 1
}

load_allowlist() {
  if [ -z "$ALLOWED_IPS" ] && [ -r "$CLIENT" ]; then
    ALLOWED_IPS=$(sed -n 's/^DEFAULT_USER_ALLOWED_IPS="\(.*\)"$/\1/p' "$CLIENT")
  fi
  [ -n "$ALLOWED_IPS" ] || fail "could not read DEFAULT_USER_ALLOWED_IPS from $CLIENT; set ALLOWED_IPS"
}

# host_addresses - prints "<interface> <address>" for each non-loopback IPv4
# address of this host.
host_addresses() {
  if command -v ip >/dev/null 2>&1; then
    ip -o -4 addr show | awk '{ split($4, a, "/"); if (a[1] !~ /^127\./) print $2, a[1] }'
  elif command -v ifconfig >/dev/null 2>&1; then
    ifconfig | awk '
      /^[^ \t]/ { iface = $1; sub(/:$/, "", iface) }
      $1 == "inet" && $2 !~ /^127\./ { print iface, $2 }'
  else
    log "neither ip nor ifconfig is available; no host addresses listed"
  fi
}

# default_lan_ip - the first host address not on a Docker or VM bridge.
default_lan_ip() {
  host_addresses | awk '$1 !~ /^(docker|br-|veth|virbr|bridge|vmnet|utun|lxc|lxd)/ { print $2; exit }'
}

resolve_runtime() {
  local has_sysbox=false
  if docker info --format '{{range $k, $v := .Runtimes}}{{$k}}{{"\n"}}{{end}}' 2>/dev/null \
    | grep -qx sysbox-runc; then
    has_sysbox=true
  fi
  case "$RUNTIME" in
    auto)
      if [ "$has_sysbox" = "true" ]; then echo sysbox; else echo privileged; fi
      ;;
    sysbox)
      [ "$has_sysbox" = "true" ] || fail "RUNTIME=sysbox but the daemon has no sysbox-runc runtime"
      echo sysbox
      ;;
    privileged) echo privileged ;;
    *) fail "invalid RUNTIME '$RUNTIME' (expected auto, sysbox or privileged)" ;;
  esac
}

# seen_address <url> - prints the source address the probe saw for a request
# to <url>, or nothing when it did not answer.
seen_address() {
  local raw
  raw=$(curl -s --max-time 5 "$1" 2>/dev/null | tr -d '\r' | sed -n 's/^RemoteAddr: *//p' | head -n 1 || true)
  [ -n "$raw" ] || return 0
  raw="${raw%:*}"
  raw="${raw#[}"
  raw="${raw%]}"
  printf '%s\n' "$raw"
}

describe_seen() {
  local seen="$1"
  if [ -z "$seen" ]; then
    echo "no answer"
  elif in_allowlist "$seen"; then
    echo "$seen (inside the allowlist)"
  else
    echo "$seen (OUTSIDE the allowlist)"
  fi
}

# start_probe <bind> <local url> - starts the Vault probe container published
# on <bind>:PORT and waits until <local url> answers.
start_probe() {
  local bind="$1" url="$2" runtime_flag deadline seen=""
  case "$RUNTIME_USED" in
    sysbox) runtime_flag="--runtime=sysbox-runc" ;;
    *) runtime_flag="--privileged" ;;
  esac
  log "starting $CONTAINER ($VAULT_IMAGE, $RUNTIME_USED) on $bind:$PORT"
  STARTED=true
  docker volume create "$VOLUME" >/dev/null
  docker create --name "$CONTAINER" "$runtime_flag" \
    -v "$VOLUME:/var/lib/docker" -p "$bind:$PORT:80" "$VAULT_IMAGE" >/dev/null
  docker cp "$PROBE_DIR/." "$CONTAINER:/vault" >/dev/null
  docker start "$CONTAINER" >/dev/null

  log "waiting for the probe at $url (the inner daemon pulls the probe image)"
  deadline=$(( $(date +%s) + PROBE_TIMEOUT ))
  while [ "$(date +%s)" -lt "$deadline" ]; do
    if ! docker container inspect -f '{{.State.Running}}' "$CONTAINER" 2>/dev/null | grep -q true; then
      fail "container $CONTAINER is not running"
    fi
    seen=$(seen_address "$url")
    if [ -n "$seen" ]; then
      return 0
    fi
    sleep 3
  done
  fail "the probe at $url did not answer within ${PROBE_TIMEOUT}s"
}

report_outer_network() {
  local gateway address
  gateway=$(docker_or unknown network inspect bridge --format "{{range .IPAM.Config}}{{.Gateway}} {{end}}")
  address=$(docker_or unknown inspect "$CONTAINER" --format "{{range .NetworkSettings.Networks}}{{.IPAddress}} {{end}}")
  report "outer bridge gateway: ${gateway% }"
  report "vault container address: ${address% }"
}

hold_if_asked() {
  SUCCESS=true
  if [ "$HOLD" = "true" ]; then
    log "HOLD=true: the probe stays up; press Ctrl-C to stop and clean up"
    while :; do
      sleep 5
    done
  fi
}

mode_probe() {
  local local_addr iface addr
  is_ipv4 "$BIND" || fail "BIND must be an IPv4 address (got '$BIND')"
  load_allowlist
  RUNTIME_USED=$(resolve_runtime)
  case "$BIND" in
    0.0.0.0) local_addr=127.0.0.1 ;;
    *) local_addr="$BIND" ;;
  esac
  [ -n "$LAN_IP" ] || LAN_IP=$(default_lan_ip)

  start_probe "$BIND" "http://$local_addr:$PORT/"

  report_environment
  report "runtime: $RUNTIME_USED"
  report "bind: $BIND (published $BIND:$PORT:80)"
  report "vault image: $VAULT_IMAGE"
  report "allowlist: $ALLOWED_IPS"
  report_outer_network
  report "request from this host to $local_addr:$PORT -> seen $(describe_seen "$(seen_address "http://$local_addr:$PORT/")")"
  if [ "$BIND" = "0.0.0.0" ]; then
    while read -r iface addr; do
      [ -n "$addr" ] || continue
      report "request from this host to $addr:$PORT ($iface) -> seen $(describe_seen "$(seen_address "http://$addr:$PORT/")")"
    done < <(host_addresses)
  fi
  case "$BIND" in
    127.*) report "PROBE_URL: http://$local_addr:$PORT/ (loopback only; use the reach mode for the LAN checks)" ;;
    0.0.0.0)
      report "PROBE_URL: http://${LAN_IP:-<this host LAN IP>}:$PORT/"
      report "LAN machine command (HOLD=true): curl -s --max-time 5 http://${LAN_IP:-<this host LAN IP>}:$PORT/ | grep RemoteAddr"
      ;;
    *)
      report "PROBE_URL: http://$BIND:$PORT/"
      report "LAN machine command (HOLD=true): curl -s --max-time 5 http://$BIND:$PORT/ | grep RemoteAddr"
      ;;
  esac
  print_report
  hold_if_asked
}

mode_reach() {
  local iface addr code rc container_ip
  if [ "$BIND" != "127.0.0.1" ]; then
    log "reach always publishes on 127.0.0.1 (ignoring BIND=$BIND)"
  fi
  BIND=127.0.0.1
  load_allowlist
  RUNTIME_USED=$(resolve_runtime)
  [ -n "$LAN_IP" ] || LAN_IP=$(default_lan_ip)

  start_probe "$BIND" "http://127.0.0.1:$PORT/"

  report_environment
  report "runtime: $RUNTIME_USED"
  report "bind: 127.0.0.1 (published 127.0.0.1:$PORT:80)"
  report "vault image: $VAULT_IMAGE"
  report_outer_network
  report "request from this host to 127.0.0.1:$PORT -> seen $(describe_seen "$(seen_address "http://127.0.0.1:$PORT/")")"
  while read -r iface addr; do
    [ -n "$addr" ] || continue
    code=$(curl -s -o /dev/null --max-time 3 -w '%{http_code}' "http://$addr:$PORT/" 2>/dev/null) && rc=0 || rc=$?
    if [ "$rc" -eq 0 ]; then
      report "reach $addr:$PORT ($iface): REACHABLE (HTTP $code)"
    else
      report "reach $addr:$PORT ($iface): not reachable (curl exit $rc)"
    fi
  done < <(host_addresses)

  container_ip=$(docker_or "" inspect "$CONTAINER" \
    --format '{{range .NetworkSettings.Networks}}{{.IPAddress}} {{end}}')
  container_ip="${container_ip%% *}"
  report "LAN machine command, host port (expected: no answer): curl -s --max-time 5 http://${LAN_IP:-<this host LAN IP>}:$PORT/ | grep RemoteAddr"
  report "LAN machine command, moby#45610 (Linux LAN machine on the same segment, needs root; expected on Engine 28+: no answer): sudo ip route add ${container_ip:-<vault container address>}/32 via ${LAN_IP:-<this host LAN IP>}; curl -s --max-time 5 http://${container_ip:-<vault container address>}:80/ | grep RemoteAddr; sudo ip route del ${container_ip:-<vault container address>}/32 via ${LAN_IP:-<this host LAN IP>}"
  print_report
  hold_if_asked
}

# config_port - the port from KERGHAN_HOME/config (last port= line), if any.
config_port() {
  local file="$KERGHAN_HOME/config"
  [ -r "$file" ] || return 0
  sed -n 's/#.*//; s/^[[:space:]]*port[[:space:]]*=[[:space:]]*\([0-9][0-9]*\)[[:space:]]*$/\1/p' "$file" | tail -n 1
}

b64url_decode() {
  local s
  s=$(printf '%s' "$1" | tr '_-' '/+')
  case $(( ${#s} % 4 )) in
    2) s="$s==" ;;
    3) s="$s=" ;;
  esac
  printf '%s' "$s" | base64 -d 2>/dev/null || printf '%s' "$s" | base64 -D 2>/dev/null || true
}

instance_runtime() {
  local runtime privileged
  runtime=$(docker_or "" inspect -f '{{.HostConfig.Runtime}}' "$KERGHAN_CONTAINER")
  privileged=$(docker_or "" inspect -f '{{.HostConfig.Privileged}}' "$KERGHAN_CONTAINER")
  if [ "$runtime" = "sysbox-runc" ]; then
    echo sysbox
  elif [ "$privileged" = "true" ]; then
    echo privileged
  else
    echo "${runtime:-unknown}"
  fi
}

mode_e2e() {
  local port out code body token payload logged_in is_admin user result env_lines line
  if [ -z "$BASE_URL" ]; then
    port=$(config_port)
    BASE_URL="http://localhost:${port:-3000}"
  fi
  BASE_URL="${BASE_URL%/}"

  log "POST $BASE_URL/auth/status.json (no cookies)"
  out=$(curl -s -i --max-time 15 -X POST -H 'Content-Type: application/json' -d '{}' \
    -w '\n%{http_code}' "$BASE_URL/auth/status.json") || fail "could not reach $BASE_URL"
  out=$(printf '%s\n' "$out" | tr -d '\r')
  code=$(printf '%s\n' "$out" | tail -n 1)
  body=$(printf '%s\n' "$out" | tail -n 2 | head -n 1)
  logged_in=$(printf '%s\n' "$body" | sed -nE 's/.*"loggedIn":(true|false).*/\1/p')
  is_admin=$(printf '%s\n' "$body" | sed -nE 's/.*"isAdmin":(true|false).*/\1/p')
  token=$(printf '%s\n' "$out" | sed -n 's/^[Ss]et-[Cc]ookie: *access_token=\([^;]*\).*/\1/p' | head -n 1)
  user="(none)"
  if [ -n "$token" ]; then
    payload=$(b64url_decode "$(printf '%s' "$token" | cut -d. -f2)")
    user=$(printf '%s\n' "$payload" | sed -nE 's/.*"username":"([^"]*)".*/\1/p')
    user="${user:-(unknown)}"
  fi

  result=FAIL
  if [ "$EXPECT_LOGGED_IN" = "true" ]; then
    if [ "$logged_in" = "true" ] && [ "$user" = "$EXPECT_USER" ] && [ "$is_admin" = "true" ]; then
      result=PASS
    fi
  elif [ "$logged_in" = "false" ]; then
    result=PASS
  fi

  report_environment
  report "base url: $BASE_URL"
  report "instance container: $KERGHAN_CONTAINER"
  report "instance image: $(docker_or "(not found on this machine)" inspect -f '{{.Config.Image}}' "$KERGHAN_CONTAINER")"
  report "instance state: $(docker_or "(not found on this machine)" inspect -f '{{.State.Status}}' "$KERGHAN_CONTAINER")"
  report "instance published: $(docker_or "(not found on this machine)" port "$KERGHAN_CONTAINER" 80/tcp | tr '\n' ' ')"
  report "instance runtime: $(instance_runtime)"
  env_lines=$(docker_or "" inspect -f '{{range .Config.Env}}{{println .}}{{end}}' "$KERGHAN_CONTAINER" \
    | grep -E '^KERGHAN_DEFAULT_USER_(ALWAYS_AUTHENTICATED|ALLOWED_IPS)=' || true)
  if [ -n "$env_lines" ]; then
    while IFS= read -r line; do
      report "instance env: $line"
    done <<<"$env_lines"
  fi
  report "status.json HTTP: $code"
  report "loggedIn: ${logged_in:-(missing)}"
  report "user: $user"
  report "isAdmin: ${is_admin:-(missing)}"
  if [ "$EXPECT_LOGGED_IN" = "true" ]; then
    report "expected: loggedIn=true user=$EXPECT_USER isAdmin=true"
  else
    report "expected: loggedIn=false"
  fi
  report "result: $result"
  print_report
  [ "$result" = "PASS" ] || exit 1
  SUCCESS=true
}

case "$MODE" in
  probe) mode_probe ;;
  reach) mode_reach ;;
  e2e) mode_e2e ;;
  -h | --help | help) usage ;;
  *)
    usage >&2
    fail "unknown mode '$MODE' (expected probe, reach or e2e)"
    ;;
esac
