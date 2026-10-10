#!/usr/bin/env bats
# Secret generation on the first up, and the refusal to start without them.

load helpers/setup

@test "the first up generates kerghan.env with both keys and mode 600" {
  run "$KERGHAN" up
  [ "$status" -eq 0 ]
  [ -f "$ENV_FILE" ]
  [ "$(stat -c %a "$ENV_FILE")" = "600" ]
  grep -qx 'KERGHAN_SECRET_KEY=fake-key-1' "$ENV_FILE"
  grep -qx 'KERGHAN_INTEGRATIONS_KEY=fake-key-2' "$ENV_FILE"
  assert_logged "openssl rand -base64 32"
  assert_output_contains "back this file up"
  vault_calls | grep -q '^vault up '
}

@test "an existing kerghan.env is never rewritten" {
  write_env_file
  touch -d "2020-01-01 00:00:00" "$ENV_FILE"
  before_content="$(cat "$ENV_FILE")"
  before_mtime="$(stat -c %Y "$ENV_FILE")"

  run "$KERGHAN" up
  [ "$status" -eq 0 ]
  [ "$(cat "$ENV_FILE")" = "$before_content" ]
  [ "$(stat -c %Y "$ENV_FILE")" = "$before_mtime" ]
  refute_logged_prefix "openssl"
}

@test "up refuses when kerghan.env is missing but the data volume exists" {
  export STUB_VOLUME_EXISTS=1
  run "$KERGHAN" up
  [ "$status" -eq 1 ]
  assert_output_contains "kerghan: error: ~/.kerghan/kerghan.env is missing but the data volume vault-kerghan-data exists"
  assert_output_contains "kerghan: hint: restore kerghan.env from your backup, or run 'kerghan reset'"
  [ ! -e "$ENV_FILE" ]
  refute_logged_prefix "vault"
  refute_logged_prefix "openssl"
}

@test "up starts when kerghan.env exists alongside the data volume" {
  export STUB_VOLUME_EXISTS=1
  write_env_file
  run "$KERGHAN" up
  [ "$status" -eq 0 ]
  vault_calls | grep -q '^vault up '
}
