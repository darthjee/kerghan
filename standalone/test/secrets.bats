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

@test "the first up writes the default user to kerghan.env" {
  run "$KERGHAN" up
  [ "$status" -eq 0 ]
  [ "$(stat -c %a "$ENV_FILE")" = "600" ]
  grep -qx 'KERGHAN_DEFAULT_USER_ENABLED=true' "$ENV_FILE"
  grep -qx 'KERGHAN_DEFAULT_USER_USERNAME=admin' "$ENV_FILE"
  grep -qx 'KERGHAN_DEFAULT_USER_EMAIL=admin@kerghan.local' "$ENV_FILE"
  grep -qx 'KERGHAN_DEFAULT_USER_ADMIN=true' "$ENV_FILE"
  assert_logged "openssl rand -hex 24"
  [ "$(grep -c '^openssl rand' "$STUB_LOG")" -eq 3 ]
  assert_output_contains "password of the 'admin' user"
}

@test "the generated admin password is the third openssl value, 32+ hex characters" {
  run "$KERGHAN" up
  [ "$status" -eq 0 ]
  password="$(sed -n 's/^KERGHAN_DEFAULT_USER_PASSWORD=//p' "$ENV_FILE")"
  [ "${#password}" -ge 32 ]
  [ "${#password}" -eq 48 ]
  case "$password" in
    3* ) ;;
    *) echo "unexpected password: $password" >&2; return 1 ;;
  esac
  case "$password" in
    *[!0-9a-f]*) echo "not hex: $password" >&2; return 1 ;;
  esac
}

@test "the first up does not write the client-managed default-user variables" {
  run "$KERGHAN" up
  [ "$status" -eq 0 ]
  [ "$(grep -c '^KERGHAN_DEFAULT_USER_ALWAYS_AUTHENTICATED=' "$ENV_FILE")" -eq 0 ]
  [ "$(grep -c '^KERGHAN_DEFAULT_USER_ALLOWED_IPS=' "$ENV_FILE")" -eq 0 ]
}

@test "the first up writes a dangling symlinked kerghan.env at its target" {
  mkdir -p "$HOME/.kerghan" "$TEST_ROOT/dotfiles"
  ln -s "$TEST_ROOT/dotfiles/kerghan.env" "$ENV_FILE"
  run "$KERGHAN" up
  [ "$status" -eq 0 ]
  [ -L "$ENV_FILE" ]
  grep -qx 'KERGHAN_SECRET_KEY=fake-key-1' "$TEST_ROOT/dotfiles/kerghan.env"
  [ "$(stat -c %a "$TEST_ROOT/dotfiles/kerghan.env")" = "600" ]
  [ "$(ls -A "$TEST_ROOT/dotfiles")" = "kerghan.env" ]
  vault_calls | grep -q '^vault up '
}

@test "a failed kerghan.env write stops up and leaves no file behind" {
  cp "$BATS_TEST_DIRNAME/stubs/mv" "$STUB_BIN/mv"
  chmod +x "$STUB_BIN/mv"
  export STUB_MV_FAIL=1
  run "$KERGHAN" up
  [ "$status" -eq 1 ]
  assert_output_contains "kerghan: error: could not write $ENV_FILE; it was left unchanged"
  [[ "$output" != *"back this file up"* ]]
  [ ! -e "$ENV_FILE" ]
  [ -z "$(ls -A "$HOME/.kerghan")" ]
  refute_logged_prefix "vault"
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
