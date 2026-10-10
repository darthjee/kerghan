#!/usr/bin/env bash
# Smoke test for darthjee/kerghan-standalone (run from the repo root).
#
# Builds the standalone image (unless SKIP_BUILD=true), boots it with
# --privileged, checks /health.json and / through Tent on Vault port 80,
# restarts the container with its data volume kept, and checks that no env
# file or secret is baked into the image. Always removes its container and
# data volume.
#
# Env inputs (all optional):
#   IMAGE            tag to test           (default darthjee/kerghan-standalone:dev)
#   KERGHAN_VERSION  build arg             (default latest)
#   SMOKE_PORT       host port for port 80 (default 3080)
#   SKIP_BUILD       true to test an already-built IMAGE
#   SMOKE_TIMEOUT    seconds to wait for /health.json (default 300)
#   SMOKE_PRELOAD_DIR  host folder of `docker save` tarballs mounted at
#                    /vault/images (Vault loads them before compose up), e.g.
#                    to test before the inner images are published
#   SMOKE_EXPECT_OFFLINE  true to also assert, after the first boot, that
#                    COMPOSE_UP_ARGS holds `--pull never` and that the inner
#                    daemon has darthjee/kerghan:$KERGHAN_VERSION, mysql:9.3.0
#                    and the TENT_IMAGE from /vault/.env, i.e. that the stack
#                    started from the preloaded tarballs (default false)
set -euo pipefail

IMAGE="${IMAGE:-darthjee/kerghan-standalone:dev}"
KERGHAN_VERSION="${KERGHAN_VERSION:-latest}"
SMOKE_PORT="${SMOKE_PORT:-3080}"
SKIP_BUILD="${SKIP_BUILD:-false}"
SMOKE_TIMEOUT="${SMOKE_TIMEOUT:-300}"
SMOKE_PRELOAD_DIR="${SMOKE_PRELOAD_DIR:-}"
SMOKE_EXPECT_OFFLINE="${SMOKE_EXPECT_OFFLINE:-false}"

RUN_ID="$$-$(date +%s)"
CONTAINER="kerghan-standalone-smoke-$RUN_ID"
VOLUME="kerghan-standalone-smoke-data-$RUN_ID"
BASE_URL="http://localhost:$SMOKE_PORT"
SUCCESS=false

log() {
  printf '[smoke] %s\n' "$*"
}

fail() {
  printf '[smoke] FAILED: %s\n' "$*" >&2
  exit 1
}

cleanup() {
  if [ "$SUCCESS" != "true" ] && docker container inspect "$CONTAINER" >/dev/null 2>&1; then
    log "last container logs:"
    docker logs --tail 100 "$CONTAINER" 2>&1 || true
  fi
  docker rm -f "$CONTAINER" >/dev/null 2>&1 || true
  docker volume rm -f "$VOLUME" >/dev/null 2>&1 || true
}
trap cleanup EXIT

generate_secret() {
  docker run --rm alpine:3 sh -c 'head -c 32 /dev/urandom | base64'
}

# Polls a URL until it answers 200 or the timeout elapses.
wait_for_200() {
  local url="$1" deadline code
  deadline=$(( $(date +%s) + SMOKE_TIMEOUT ))
  while [ "$(date +%s)" -lt "$deadline" ]; do
    if ! docker container inspect -f '{{.State.Running}}' "$CONTAINER" 2>/dev/null | grep -q true; then
      fail "container $CONTAINER is not running"
    fi
    code=$(curl -s -o /dev/null -w '%{http_code}' "$url" || true)
    if [ "$code" = "200" ]; then
      return 0
    fi
    sleep 5
  done
  fail "$url did not answer 200 within ${SMOKE_TIMEOUT}s (last: ${code:-none})"
}

inner_mysql() {
  docker exec -w /vault "$CONTAINER" \
    docker compose exec -T mysql mysql -ukerghan -p"${KERGHAN_MYSQL_PASSWORD:-kerghan}" kerghan \
    --batch --skip-column-names -e "$1" 2>/dev/null
}

# Asserts the offline image started from its preloaded tarballs: compose runs
# with --pull never and every inner image is already in the inner daemon.
check_offline() {
  local compose_args tent_image image
  log "checking the offline preload"
  compose_args=$(docker exec "$CONTAINER" printenv COMPOSE_UP_ARGS || true)
  case " $compose_args " in
    *" --pull never "*) ;;
    *) fail "COMPOSE_UP_ARGS is '${compose_args}', expected it to contain '--pull never'" ;;
  esac
  tent_image=$(docker exec "$CONTAINER" sh -c 'sed -n "s/^TENT_IMAGE=//p" /vault/.env' || true)
  [ -n "$tent_image" ] || fail "could not read TENT_IMAGE from /vault/.env"
  for image in "darthjee/kerghan:$KERGHAN_VERSION" "mysql:9.3.0" "$tent_image"; do
    docker exec "$CONTAINER" docker image inspect "$image" >/dev/null 2>&1 \
      || fail "inner image $image is missing from the inner daemon (not preloaded)"
  done
}

if [ "$SKIP_BUILD" != "true" ]; then
  log "building $IMAGE (KERGHAN_VERSION=$KERGHAN_VERSION)"
  docker build -f dockerfiles/kerghan_standalone/Dockerfile --target standalone \
    --build-arg KERGHAN_VERSION="$KERGHAN_VERSION" -t "$IMAGE" .
fi

log "checking that no env file or secret is baked into $IMAGE"
vault_env=$(docker run --rm --entrypoint sh "$IMAGE" -c 'cat /vault/.env')
unexpected=$(printf '%s\n' "$vault_env" | grep -vE '^(TENT_IMAGE|KERGHAN_VERSION)=' || true)
[ -z "$unexpected" ] || fail "/vault/.env holds unexpected entries: $unexpected"
printf '%s\n' "$vault_env" | grep -q '^TENT_IMAGE=darthjee/tent:' || fail "/vault/.env has no TENT_IMAGE"
printf '%s\n' "$vault_env" | grep -q "^KERGHAN_VERSION=" || fail "/vault/.env has no KERGHAN_VERSION"
stray=$(docker run --rm --entrypoint sh "$IMAGE" -c \
  'find / -xdev \( -name ".env" -o -name ".env.*" -o -name "*.env" \) ! -path /vault/.env 2>/dev/null' || true)
[ -z "$stray" ] || fail "env files found in the image: $stray"
secret_vars=$(docker image inspect -f '{{range .Config.Env}}{{println .}}{{end}}' "$IMAGE" \
  | grep -E 'SECRET|_KEY|PASSWORD' || true)
[ -z "$secret_vars" ] || fail "secret-looking ENV baked into the image: $secret_vars"

log "generating test secrets"
KERGHAN_SECRET_KEY=$(generate_secret)
KERGHAN_INTEGRATIONS_KEY=$(generate_secret)
[ "$KERGHAN_SECRET_KEY" != "$KERGHAN_INTEGRATIONS_KEY" ] || fail "generated secrets are identical"
export KERGHAN_SECRET_KEY KERGHAN_INTEGRATIONS_KEY

preload_args=()
if [ -n "$SMOKE_PRELOAD_DIR" ]; then
  [ -d "$SMOKE_PRELOAD_DIR" ] || fail "SMOKE_PRELOAD_DIR $SMOKE_PRELOAD_DIR is not a folder"
  preload_args=(-v "$(cd "$SMOKE_PRELOAD_DIR" && pwd):/vault/images:ro")
fi

log "starting $CONTAINER on port $SMOKE_PORT"
docker run -d --privileged --name "$CONTAINER" ${preload_args[@]+"${preload_args[@]}"} \
  -v "$VOLUME:/var/lib/docker" -p "$SMOKE_PORT:80" \
  -e KERGHAN_SECRET_KEY -e KERGHAN_INTEGRATIONS_KEY \
  -e FRONTEND_BASE_URL="$BASE_URL" \
  "$IMAGE" >/dev/null

log "waiting for $BASE_URL/health.json (first boot pulls images and initializes MySQL)"
wait_for_200 "$BASE_URL/health.json"

if [ "$SMOKE_EXPECT_OFFLINE" = "true" ]; then
  check_offline
fi

log "checking the frontend at $BASE_URL/"
body=$(curl -s -w '\n%{http_code}' "$BASE_URL/")
code=$(printf '%s\n' "$body" | tail -n 1)
[ "$code" = "200" ] || fail "GET / answered $code"
printf '%s\n' "$body" | grep -q 'id="root"' || fail "GET / did not return the app's index.html"

log "writing a marker row before the restart"
inner_mysql "CREATE TABLE IF NOT EXISTS smoke_marker (run_id VARCHAR(64)); INSERT INTO smoke_marker VALUES ('$RUN_ID');" \
  || fail "could not write the marker row"

log "restarting $CONTAINER with its data volume kept"
docker restart -t 60 "$CONTAINER" >/dev/null
wait_for_200 "$BASE_URL/health.json"

marker=$(inner_mysql "SELECT run_id FROM smoke_marker;" || true)
[ "$marker" = "$RUN_ID" ] || fail "data did not survive the restart (marker: '${marker}')"

SUCCESS=true
log "OK: $IMAGE boots, serves /health.json and /, and keeps data across a restart"
