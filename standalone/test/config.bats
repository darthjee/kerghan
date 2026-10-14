#!/usr/bin/env bats
# ~/.kerghan/config: parsing, precedence (flag > file > default), errors,
# runtime / stop-timeout reaching vault, and image-tag.

load helpers/setup

URL_ARGS="-e FRONTEND_BASE_URL=http://localhost"

# up_line <image> <port> [runtime] [stop-timeout] - the expected `vault up` line.
up_line() {
  echo "vault up --name kerghan --image $1 --env-file $ENV_FILE -p 127.0.0.1:$2:80 $URL_ARGS:$2 $DEFAULT_USER_ARGS --runtime ${3:-auto} --stop-timeout ${4:-60}"
}

# refute_side_effects - no vault call, no openssl call, no kerghan.env.
refute_side_effects() {
  [ -z "$(vault_calls)" ]
  refute_logged_prefix "openssl"
  refute_logged_prefix "docker"
  [ ! -e "$ENV_FILE" ]
}

# --- defaults and precedence ---

@test "without a config file every key uses its default" {
  write_env_file
  run "$KERGHAN" up
  [ "$status" -eq 0 ]
  [ "$(vault_calls)" = "$(up_line "$IMAGE" 3000)" ]
  [[ "$output" != *warning* ]]
}

@test "port= from the file is used" {
  write_env_file
  write_config "port=8080"
  run "$KERGHAN" up
  [ "$status" -eq 0 ]
  [ "$(vault_calls)" = "$(up_line "$IMAGE" 8080)" ]
  assert_output_contains "Kerghan is running at http://localhost:8080"
}

@test "-p wins over port= from the file" {
  write_env_file
  write_config "port=8080"
  run "$KERGHAN" up -p 9090
  [ "$status" -eq 0 ]
  [ "$(vault_calls)" = "$(up_line "$IMAGE" 9090)" ]
}

@test "variant=offline applies without the flag" {
  write_env_file
  write_config "variant=offline"
  run "$KERGHAN" up
  [ "$status" -eq 0 ]
  [ "$(vault_calls)" = "$(up_line "$IMAGE-offline" 3000)" ]
}

@test "--offline wins over variant=online" {
  write_env_file
  write_config "variant=online"
  run "$KERGHAN" up --offline
  [ "$status" -eq 0 ]
  [ "$(vault_calls)" = "$(up_line "$IMAGE-offline" 3000)" ]
}

@test "variant=online uses the online image" {
  write_env_file
  write_config "variant=online"
  run "$KERGHAN" up
  [ "$status" -eq 0 ]
  [ "$(vault_calls)" = "$(up_line "$IMAGE" 3000)" ]
}

@test "runtime and stop-timeout from the file reach vault up" {
  write_env_file
  write_config "runtime=privileged" "stop-timeout=120"
  run "$KERGHAN" up
  [ "$status" -eq 0 ]
  [ "$(vault_calls)" = "$(up_line "$IMAGE" 3000 privileged 120)" ]
}

@test "runtime=sysbox reaches vault up" {
  write_env_file
  write_config "runtime=sysbox"
  run "$KERGHAN" up
  [ "$status" -eq 0 ]
  [ "$(vault_calls)" = "$(up_line "$IMAGE" 3000 sysbox)" ]
}

@test "stop-timeout reaches kerghan down" {
  write_config "stop-timeout=90"
  run "$KERGHAN" down
  [ "$status" -eq 0 ]
  [ "$(vault_calls)" = "vault down --name kerghan --stop-timeout 90" ]
}

@test "stop-timeout reaches the down before a recreate" {
  write_env_file
  write_config "stop-timeout=90" "runtime=privileged"
  export STUB_RUNNING_IMAGE="$IMAGE_REPO:$OLDER_VERSION"
  run "$KERGHAN" up
  [ "$status" -eq 0 ]
  [ "$(vault_calls | sed -n 1p)" = "vault down --name kerghan --stop-timeout 90" ]
  [ "$(vault_calls | sed -n 2p)" = "$(up_line "$IMAGE" 3000 privileged 90)" ]
}

@test "stop-timeout reaches reset" {
  write_config "stop-timeout=15"
  run "$KERGHAN" reset <<<"y"
  [ "$status" -eq 0 ]
  assert_logged "vault down --name kerghan --stop-timeout 15"
}

# --- parsing ---

@test "comments, blank lines and whitespace are ignored" {
  write_env_file
  write_config \
    "# a whole-line comment" \
    "" \
    "   " \
    "  port = 8080   # trailing comment" \
    "	variant=offline	" \
    "runtime=privileged#no space before the comment" \
    "   # indented comment"
  run "$KERGHAN" up
  [ "$status" -eq 0 ]
  [ "$(vault_calls)" = "$(up_line "$IMAGE-offline" 8080 privileged)" ]
  [[ "$output" != *warning* ]]
}

@test "empty values fall back to the defaults" {
  write_env_file
  write_config "port=" "variant=   # comment" "runtime=" "stop-timeout=" "image-tag="
  run "$KERGHAN" up
  [ "$status" -eq 0 ]
  [ "$(vault_calls)" = "$(up_line "$IMAGE" 3000)" ]
}

@test "a file without a trailing newline reads its last line" {
  write_env_file
  mkdir -p "$HOME/.kerghan"
  printf 'variant=offline\nport=8080' >"$HOME/.kerghan/config"
  run "$KERGHAN" up
  [ "$status" -eq 0 ]
  [ "$(vault_calls)" = "$(up_line "$IMAGE-offline" 8080)" ]
}

@test "an empty config file uses the defaults" {
  write_env_file
  mkdir -p "$HOME/.kerghan"
  : >"$HOME/.kerghan/config"
  run "$KERGHAN" up
  [ "$status" -eq 0 ]
  [ "$(vault_calls)" = "$(up_line "$IMAGE" 3000)" ]
}

@test "an unknown key warns with the line and key, and the command continues" {
  write_env_file
  write_config "port=8080" "# comment" "colour=blue"
  run "$KERGHAN" up
  [ "$status" -eq 0 ]
  assert_output_contains "kerghan: warning: $CONFIG_FILE:3: unknown key 'colour' (ignored)"
  [ "$(vault_calls)" = "$(up_line "$IMAGE" 8080)" ]
}

# --- errors ---

@test "a line without = fails with the line number and touches nothing" {
  write_config "port=8080" "" "offline"
  run "$KERGHAN" up
  [ "$status" -eq 1 ]
  assert_output_contains "kerghan: error: $CONFIG_FILE:3: expected key=value"
  refute_side_effects
}

@test "invalid values fail with the line number and touch nothing" {
  local bad
  for bad in "port=abc" "port=70000" "port=0" "variant=foo" "runtime=docker" \
    "stop-timeout=0" "stop-timeout=-5" "stop-timeout=abc" "stop-timeout=1.5" \
    "image-tag=bad/tag" "image-tag=-dev" "image-tag=.dev" "image-tag=0.4.0-offline" \
    "image-tag=has space"; do
    : >"$STUB_LOG"
    write_config "# first line" "$bad"
    run "$KERGHAN" up
    if [ "$status" -ne 1 ]; then
      echo "expected status 1 for '$bad', got $status: $output" >&2
      return 1
    fi
    assert_output_contains "kerghan: error: $CONFIG_FILE:2: invalid ${bad%%=*} '${bad#*=}'"
    refute_side_effects
  done
}

@test "an image-tag longer than 128 characters is rejected" {
  write_config "image-tag=$(printf 'a%.0s' $(seq 1 129))"
  run "$KERGHAN" up
  [ "$status" -eq 1 ]
  assert_output_contains "$CONFIG_FILE:1: invalid image-tag"
  refute_side_effects
}

@test "a malformed config fails down before calling vault" {
  write_config "port=abc"
  run "$KERGHAN" down
  [ "$status" -eq 1 ]
  assert_output_contains "$CONFIG_FILE:1: invalid port 'abc'"
  [ -z "$(vault_calls)" ]
}

@test "a malformed config fails reset before the prompt" {
  export STUB_VOLUME_EXISTS=1
  write_config "variant=foo"
  run "$KERGHAN" reset <<<"y"
  [ "$status" -eq 1 ]
  assert_output_contains "$CONFIG_FILE:1: invalid variant 'foo'"
  [[ "$output" != *"Continue?"* ]]
  [ -z "$(vault_calls)" ]
  refute_logged_prefix "docker volume rm"
}

@test "version, help, logs, status and compose ignore a malformed config" {
  write_config "garbage"
  run "$KERGHAN" version
  [ "$status" -eq 0 ]
  [ "$output" = "kerghan $CURRENT_VERSION" ]
  run "$KERGHAN" help
  [ "$status" -eq 0 ]
  assert_output_contains "Usage: kerghan"
  run "$KERGHAN" status
  [ "$status" -eq 0 ]
  run "$KERGHAN" logs
  [ "$status" -eq 0 ]
  run "$KERGHAN" compose ps
  [ "$status" -eq 0 ]
}

# --- image-tag ---

@test "a semver image-tag replaces the version, online" {
  write_env_file
  write_config "image-tag=$OLDER_VERSION"
  run "$KERGHAN" up
  [ "$status" -eq 0 ]
  [ "$(vault_calls)" = "$(up_line "$IMAGE_REPO:$OLDER_VERSION" 3000)" ]
}

@test "a semver image-tag keeps the -offline suffix for the offline variant" {
  write_env_file
  write_config "image-tag=$OLDER_VERSION"
  run "$KERGHAN" up --offline
  [ "$status" -eq 0 ]
  [ "$(vault_calls)" = "$(up_line "$IMAGE_REPO:$OLDER_VERSION-offline" 3000)" ]
}

@test "a semver image-tag upgrades an older running instance" {
  write_env_file
  write_config "image-tag=$NEWER_VERSION"
  export STUB_RUNNING_IMAGE="$IMAGE"
  run "$KERGHAN" up
  [ "$status" -eq 0 ]
  assert_output_contains "upgrading $IMAGE -> $IMAGE_REPO:$NEWER_VERSION"
  [ "$(vault_calls | sed -n 1p)" = "vault down --name kerghan --stop-timeout 60" ]
  [ "$(vault_calls | sed -n 2p)" = "$(up_line "$IMAGE_REPO:$NEWER_VERSION" 3000)" ]
}

@test "a semver image-tag older than the running instance is a refused downgrade" {
  write_env_file
  write_config "image-tag=$OLDER_VERSION"
  export STUB_RUNNING_IMAGE="$IMAGE"
  run "$KERGHAN" up
  [ "$status" -eq 1 ]
  assert_output_contains "kerghan: warning: the running instance uses $IMAGE, newer than image-tag $OLDER_VERSION"
  assert_output_contains "image-tag=$CURRENT_VERSION"
  [ -z "$(vault_calls)" ]
}

@test "a semver image-tag matching the running instance and port is a no-op" {
  write_env_file
  write_config "image-tag=$OLDER_VERSION" "variant=offline"
  export STUB_RUNNING_IMAGE="$IMAGE_REPO:$OLDER_VERSION-offline" STUB_RUNNING_PORT=3000
  run "$KERGHAN" up
  [ "$status" -eq 0 ]
  assert_output_contains "Kerghan is already running at http://localhost:3000"
  [ -z "$(vault_calls)" ]
}

@test "a non-semver image-tag runs that tag, with both variants" {
  write_env_file
  write_config "image-tag=latest"
  run "$KERGHAN" up
  [ "$status" -eq 0 ]
  [ "$(vault_calls)" = "$(up_line "darthjee/kerghan-standalone:latest" 3000)" ]
  : >"$STUB_LOG"
  run "$KERGHAN" up --offline
  [ "$status" -eq 0 ]
  [ "$(vault_calls)" = "$(up_line "darthjee/kerghan-standalone:latest-offline" 3000)" ]
}

@test "a non-semver image-tag is a no-op when the same image and port run" {
  write_env_file
  write_config "image-tag=latest"
  export STUB_RUNNING_IMAGE="darthjee/kerghan-standalone:latest" STUB_RUNNING_PORT=3000
  run "$KERGHAN" up
  [ "$status" -eq 0 ]
  assert_output_contains "Kerghan is already running at http://localhost:3000"
  [ -z "$(vault_calls)" ]
}

@test "a non-semver image-tag moves the port when only the port differs" {
  write_env_file
  write_config "image-tag=latest" "port=8080"
  export STUB_RUNNING_IMAGE="darthjee/kerghan-standalone:latest" STUB_RUNNING_PORT=3000
  run "$KERGHAN" up
  [ "$status" -eq 0 ]
  assert_output_contains "moving to port 8080"
  [ "$(vault_calls | sed -n 2p)" = "$(up_line "darthjee/kerghan-standalone:latest" 8080)" ]
}

@test "a non-semver image-tag recreates a running release without a downgrade guard" {
  write_env_file
  write_config "image-tag=latest"
  export STUB_RUNNING_IMAGE="darthjee/kerghan-standalone:9.9.9"
  run "$KERGHAN" up
  [ "$status" -eq 0 ]
  assert_output_contains "replacing darthjee/kerghan-standalone:9.9.9 -> darthjee/kerghan-standalone:latest"
  [[ "$output" != *downgrade* ]]
  [ "$(vault_calls | sed -n 1p)" = "vault down --name kerghan --stop-timeout 60" ]
  [ "$(vault_calls | sed -n 2p)" = "$(up_line "darthjee/kerghan-standalone:latest" 3000)" ]
}

@test "a non-semver image-tag recreates a different variant" {
  write_env_file
  write_config "image-tag=latest"
  export STUB_RUNNING_IMAGE="darthjee/kerghan-standalone:latest"
  run "$KERGHAN" up --offline
  [ "$status" -eq 0 ]
  [ "$(vault_calls | sed -n 2p)" = "$(up_line "darthjee/kerghan-standalone:latest-offline" 3000)" ]
}

# --- recreation ---

@test "a runtime or stop-timeout change alone does not recreate" {
  write_env_file
  write_config "runtime=privileged" "stop-timeout=300"
  export STUB_RUNNING_IMAGE="$IMAGE" STUB_RUNNING_PORT=3000
  run "$KERGHAN" up
  [ "$status" -eq 0 ]
  assert_output_contains "Kerghan is already running at http://localhost:3000"
  [ -z "$(vault_calls)" ]
}

@test "a port= change recreates the instance" {
  write_env_file
  write_config "port=8080"
  export STUB_RUNNING_IMAGE="$IMAGE" STUB_RUNNING_PORT=3000
  run "$KERGHAN" up
  [ "$status" -eq 0 ]
  assert_output_contains "moving to port 8080"
  [ "$(vault_calls | sed -n 2p)" = "$(up_line "$IMAGE" 8080)" ]
}

# --- hints ---

@test "the port-in-use hint mentions port= in ~/.kerghan/config" {
  write_env_file
  write_config "port=3000"
  export STUB_VAULT_UP_EXIT=3
  export STUB_VAULT_UP_STDERR="Error: Bind for 0.0.0.0:3000 failed: port is already allocated"
  run "$KERGHAN" up
  [ "$status" -eq 3 ]
  assert_output_contains "or set port= in ~/.kerghan/config to pick another port"
}
