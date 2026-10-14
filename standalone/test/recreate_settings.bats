#!/usr/bin/env bats
# A running instance with the same image and port is recreated (keeping the
# data volume) when auto-login or bind changed.

load helpers/setup

# up_line <bind> <auto-login> - the expected `vault up` line on port 3000.
up_line() {
  echo "vault up --name kerghan --image $IMAGE --env-file $ENV_FILE -p $1:3000:80 -e FRONTEND_BASE_URL=http://localhost:3000 $(default_user_args "$2") --runtime auto --stop-timeout 60"
}

# assert_recreated <bind> <auto-login> - vault down then vault up, volume kept.
assert_recreated() {
  [ "$(vault_calls | sed -n 1p)" = "vault down --name kerghan --stop-timeout 60" ]
  [ "$(vault_calls | sed -n 2p)" = "$(up_line "$1" "$2")" ]
  [ "$(vault_calls | wc -l)" -eq 2 ]
  refute_logged_prefix "docker volume rm"
}

setup_running() {
  write_env_file
  export STUB_VOLUME_EXISTS=1 STUB_RUNNING_IMAGE="$IMAGE" STUB_RUNNING_PORT=3000
}

@test "an unchanged auto-login and bind is a no-op" {
  setup_running
  export STUB_RUNNING_HOST_IP=127.0.0.1 \
    STUB_RUNNING_ENV="NODE_ENV=x
KERGHAN_DEFAULT_USER_ALWAYS_AUTHENTICATED=true"
  run "$KERGHAN" up
  [ "$status" -eq 0 ]
  assert_output_contains "Kerghan is already running at http://localhost:3000"
  [ -z "$(vault_calls)" ]
}

@test "an unchanged auto-login off on every interface is a no-op" {
  setup_running
  export STUB_RUNNING_HOST_IP="" STUB_RUNNING_ENV="KERGHAN_DEFAULT_USER_ALWAYS_AUTHENTICATED=false"
  write_config "auto-login=false"
  run "$KERGHAN" up
  [ "$status" -eq 0 ]
  assert_output_contains "Kerghan is already running"
  [ -z "$(vault_calls)" ]
}

@test "turning auto-login off recreates the instance" {
  setup_running
  export STUB_RUNNING_HOST_IP=0.0.0.0 STUB_RUNNING_ENV="KERGHAN_DEFAULT_USER_ALWAYS_AUTHENTICATED=true"
  run "$KERGHAN" up --no-auto-login
  [ "$status" -eq 0 ]
  assert_output_contains "turning automatic login off"
  assert_recreated 0.0.0.0 false
}

@test "turning auto-login on recreates the instance" {
  setup_running
  export STUB_RUNNING_HOST_IP=127.0.0.1 STUB_RUNNING_ENV="KERGHAN_DEFAULT_USER_ALWAYS_AUTHENTICATED=false"
  run "$KERGHAN" up
  [ "$status" -eq 0 ]
  assert_output_contains "turning automatic login on"
  assert_recreated 127.0.0.1 true
}

@test "a changed bind recreates the instance" {
  setup_running
  export STUB_RUNNING_HOST_IP=127.0.0.1
  write_config "bind=0.0.0.0"
  run "$KERGHAN" up
  [ "$status" -eq 0 ]
  assert_output_contains "publishing on 0.0.0.0"
  assert_recreated 0.0.0.0 true
}

@test "an instance published on every interface moves to 127.0.0.1" {
  setup_running
  export STUB_RUNNING_HOST_IP=""
  run "$KERGHAN" up
  [ "$status" -eq 0 ]
  assert_output_contains "publishing on 127.0.0.1"
  assert_recreated 127.0.0.1 true
}

@test "an instance started without the variable (older client) is recreated with auto-login on" {
  setup_running
  export STUB_RUNNING_HOST_IP="" STUB_RUNNING_ENV="NODE_ENV=production"
  run "$KERGHAN" up
  [ "$status" -eq 0 ]
  assert_output_contains "turning automatic login on"
  assert_recreated 127.0.0.1 true
}

@test "an image change still reports the image reason" {
  setup_running
  export STUB_RUNNING_IMAGE="$IMAGE_REPO:$OLDER_VERSION" STUB_RUNNING_ENV=""
  run "$KERGHAN" up
  [ "$status" -eq 0 ]
  assert_output_contains "upgrading $IMAGE_REPO:$OLDER_VERSION -> $IMAGE"
  assert_recreated 127.0.0.1 true
}
