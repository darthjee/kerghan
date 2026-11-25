#!/usr/bin/env bats
# file-logs / log-dir: the -e / -v words of `vault up`, the unwritable
# fallback, the older-image hint, the recreate triggers and the config checks.

load helpers/setup

NO_LOG_ARGS="-e KERGHAN_FILE_LOGS=false -e KERGHAN_HOST_UID=$(id -u) -e KERGHAN_HOST_GID=$(id -g)"

setup_running() {
  write_env_file
  export STUB_VOLUME_EXISTS=1 STUB_RUNNING_IMAGE="$IMAGE" STUB_RUNNING_PORT=3000
}

@test "up passes the log -e words and mounts ~/.kerghan/logs with mode 700" {
  write_env_file
  run "$KERGHAN" up
  [ "$status" -eq 0 ]
  vault_calls | grep -qF -- "$(log_args "$HOME/.kerghan/logs") --runtime"
  [ "$(file_mode "$HOME/.kerghan/logs")" = "700" ]
}

@test "log-dir=~/custom is expanded against HOME" {
  write_env_file
  write_config "log-dir=~/custom"
  run "$KERGHAN" up
  [ "$status" -eq 0 ]
  vault_calls | grep -qF -- "-v $HOME/custom:/vault/logs --runtime"
  [ -d "$HOME/custom" ]
}

@test "an absolute log-dir is used as is" {
  write_env_file
  write_config "log-dir=$TEST_ROOT/abs/logs"
  run "$KERGHAN" up
  [ "$status" -eq 0 ]
  vault_calls | grep -qF -- "-v $TEST_ROOT/abs/logs:/vault/logs --runtime"
}

@test "file-logs=false passes KERGHAN_FILE_LOGS=false and no mount" {
  write_env_file
  write_config "file-logs=false"
  run "$KERGHAN" up
  [ "$status" -eq 0 ]
  vault_calls | grep -qF -- "$NO_LOG_ARGS --runtime"
  ! vault_calls | grep -qF -- "/vault/logs"
  [ ! -e "$HOME/.kerghan/logs" ]
}

@test "an unwritable log directory warns and starts without file logs" {
  write_env_file
  export STUB_UNWRITABLE_DIR="$HOME/.kerghan/logs"
  run "$KERGHAN" up
  [ "$status" -eq 0 ]
  assert_output_contains "is not writable; starting without file logs"
  vault_calls | grep -qF -- "$NO_LOG_ARGS --runtime"
  ! vault_calls | grep -qF -- "/vault/logs"
}

@test "kerghan.env may not set the client-managed log variables" {
  local key
  for key in KERGHAN_FILE_LOGS KERGHAN_HOST_UID KERGHAN_HOST_GID; do
    write_env_file "$key=1"
    run "$KERGHAN" up
    [ "$status" -eq 1 ]
    assert_output_contains "sets $key, which the client manages itself"
  done
}

@test "an image-tag older than the collector release gets a hint, and up succeeds" {
  write_env_file
  write_config "image-tag=0.1.0"
  run "$KERGHAN" up
  [ "$status" -eq 0 ]
  assert_output_contains "file logs need image"
}

@test "a non-semver image-tag gets no file logs hint" {
  write_env_file
  write_config "image-tag=latest"
  run "$KERGHAN" up
  [ "$status" -eq 0 ]
  refute_output_contains "file logs need image"
}

# --- recreate ---

@test "a running instance with the same file logs and mount is not recreated" {
  setup_running
  run "$KERGHAN" up
  [ "$status" -eq 0 ]
  refute_output_contains "recreating"
  [ -z "$(vault_calls)" ]
}

@test "a running instance from an older client (no collector env) is recreated" {
  setup_running
  export STUB_FILE_LOGS=none
  run "$KERGHAN" up
  [ "$status" -eq 0 ]
  assert_output_contains "file logs changed (off -> on)"
  [ "$(vault_calls | sed -n 1p)" = "vault down --name kerghan --stop-timeout 60" ]
}

@test "turning file-logs off recreates a running instance" {
  setup_running
  write_config "file-logs=false"
  run "$KERGHAN" up
  [ "$status" -eq 0 ]
  assert_output_contains "file logs changed (on -> off)"
  vault_calls | grep -qF -- "-e KERGHAN_FILE_LOGS=false"
}

@test "a different log directory recreates a running instance" {
  setup_running
  export STUB_LOG_MOUNT="$TEST_ROOT/elsewhere"
  run "$KERGHAN" up
  [ "$status" -eq 0 ]
  assert_output_contains "log directory changed ($TEST_ROOT/elsewhere -> $HOME/.kerghan/logs)"
}

# --- config validation ---

@test "invalid log-dir values fail with the line number and touch nothing" {
  local bad
  for bad in "log-dir=relative/path" "log-dir=/a:b" "log-dir=/a b" "file-logs=yes"; do
    write_config "port=3000" "$bad"
    run "$KERGHAN" up
    [ "$status" -eq 1 ]
    assert_output_contains "$CONFIG_FILE:2: invalid ${bad%%=*} '${bad#*=}'"
    [ -z "$(vault_calls)" ]
  done
}

@test "configure writes file-logs and log-dir and refuses invalid values" {
  run "$KERGHAN" configure file-logs=false log-dir='~/x'
  [ "$status" -eq 0 ]
  grep -qx 'file-logs=false' "$CONFIG_FILE"
  grep -qx 'log-dir=~/x' "$CONFIG_FILE"
  run "$KERGHAN" configure log-dir=relative
  [ "$status" -ne 0 ]
  run "$KERGHAN" configure file-logs=maybe
  [ "$status" -ne 0 ]
}
