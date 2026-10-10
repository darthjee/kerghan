#!/usr/bin/env bats
# reset asks before wiping the data volume, and keeps kerghan.env.

load helpers/setup

@test "reset declined with n does nothing" {
  write_env_file
  export STUB_VOLUME_EXISTS=1
  run "$KERGHAN" reset <<<"n"
  [ "$status" -eq 0 ]
  assert_output_contains "Continue? [y/N]"
  assert_output_contains "Aborted."
  refute_logged_prefix "vault"
  refute_logged_prefix "docker volume rm"
}

@test "reset with empty input (the default) does nothing" {
  write_env_file
  export STUB_VOLUME_EXISTS=1
  run "$KERGHAN" reset <<<""
  [ "$status" -eq 0 ]
  assert_output_contains "Aborted."
  refute_logged_prefix "vault"
  refute_logged_prefix "docker volume rm"
}

@test "reset with closed stdin does nothing" {
  export STUB_VOLUME_EXISTS=1
  run "$KERGHAN" reset </dev/null
  [ "$status" -eq 0 ]
  refute_logged_prefix "vault"
  refute_logged_prefix "docker volume rm"
}

@test "reset confirmed with y stops the instance, removes the volume and keeps kerghan.env" {
  write_env_file
  before="$(cat "$ENV_FILE")"
  export STUB_VOLUME_EXISTS=1
  run "$KERGHAN" reset <<<"y"
  [ "$status" -eq 0 ]
  [ "$(grep -E '^(vault|docker volume rm)' "$STUB_LOG" | sed -n 1p)" = "vault down --name kerghan" ]
  [ "$(grep -E '^(vault|docker volume rm)' "$STUB_LOG" | sed -n 2p)" = "docker volume rm vault-kerghan-data" ]
  [ "$(cat "$ENV_FILE")" = "$before" ]
  assert_output_contains "Removed volume vault-kerghan-data."
}

@test "reset accepts YES in any case" {
  export STUB_VOLUME_EXISTS=1
  run "$KERGHAN" reset <<<"YeS"
  [ "$status" -eq 0 ]
  assert_logged "docker volume rm vault-kerghan-data"
}

@test "reset tolerates a missing volume" {
  run "$KERGHAN" reset <<<"y"
  [ "$status" -eq 0 ]
  assert_logged "vault down --name kerghan"
  refute_logged_prefix "docker volume rm"
  assert_output_contains "does not exist"
}
