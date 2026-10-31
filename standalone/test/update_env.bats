#!/usr/bin/env bats
# kerghan update-env: appends the default keys missing from an existing
# kerghan.env, never changes or duplicates present ones.

load helpers/setup

# refute_value_printed <value> - the command output never shows <value>.
refute_value_printed() {
  case "$output" in
    *"$1"*)
      echo "output shows the value: $1" >&2
      return 1
      ;;
  esac
}

@test "a missing kerghan.env without the data volume fails and points at up" {
  run "$KERGHAN" update-env
  [ "$status" -eq 1 ]
  assert_output_contains "kerghan: error: $ENV_FILE does not exist"
  assert_output_contains "kerghan: hint: run 'kerghan up' to create a new installation"
  [ ! -e "$ENV_FILE" ]
  refute_logged_prefix "openssl"
  refute_logged_prefix "vault"
}

@test "a missing kerghan.env with the data volume fails and points at the backup" {
  export STUB_VOLUME_EXISTS=1
  run "$KERGHAN" update-env
  [ "$status" -eq 1 ]
  assert_output_contains "kerghan: error: $ENV_FILE does not exist"
  assert_output_contains "restore kerghan.env from your backup"
  assert_output_contains "'kerghan reset'"
  [ ! -e "$ENV_FILE" ]
  refute_logged_prefix "openssl"
  refute_logged_prefix "vault"
}

@test "an up-to-date kerghan.env is left byte-identical" {
  write_env_file
  cp "$ENV_FILE" "$TEST_ROOT/before"
  run "$KERGHAN" update-env
  [ "$status" -eq 0 ]
  assert_output_contains "$ENV_FILE is up to date; nothing was added."
  cmp "$ENV_FILE" "$TEST_ROOT/before"
  refute_logged_prefix "openssl"
  refute_logged_prefix "docker"
  refute_logged_prefix "vault"
}

@test "a kerghan.env written by up is up to date" {
  run "$KERGHAN" up
  [ "$status" -eq 0 ]
  cp "$ENV_FILE" "$TEST_ROOT/before"
  : >"$STUB_LOG"
  run "$KERGHAN" update-env
  [ "$status" -eq 0 ]
  assert_output_contains "nothing was added"
  cmp "$ENV_FILE" "$TEST_ROOT/before"
  refute_logged_prefix "openssl"
}

@test "a pre-#371 kerghan.env gets the five default-user keys in order" {
  write_legacy_env_file
  run "$KERGHAN" update-env
  [ "$status" -eq 0 ]
  [ "$(sed -n 's/=.*//p' "$ENV_FILE" | tr '\n' ' ')" = "KERGHAN_SECRET_KEY KERGHAN_INTEGRATIONS_KEY KERGHAN_DEFAULT_USER_ENABLED KERGHAN_DEFAULT_USER_USERNAME KERGHAN_DEFAULT_USER_EMAIL KERGHAN_DEFAULT_USER_PASSWORD KERGHAN_DEFAULT_USER_ADMIN " ]
  grep -qx 'KERGHAN_SECRET_KEY=existing-secret' "$ENV_FILE"
  grep -qx 'KERGHAN_INTEGRATIONS_KEY=existing-integrations' "$ENV_FILE"
  grep -qx 'KERGHAN_DEFAULT_USER_ENABLED=true' "$ENV_FILE"
  grep -qx 'KERGHAN_DEFAULT_USER_USERNAME=admin' "$ENV_FILE"
  grep -qx 'KERGHAN_DEFAULT_USER_EMAIL=admin@kerghan.local' "$ENV_FILE"
  grep -qx 'KERGHAN_DEFAULT_USER_ADMIN=true' "$ENV_FILE"
  assert_logged "openssl rand -hex 24"
  [ "$(grep -c '^openssl rand' "$STUB_LOG")" -eq 1 ]
  password="$(sed -n 's/^KERGHAN_DEFAULT_USER_PASSWORD=//p' "$ENV_FILE")"
  [ "${#password}" -eq 48 ]
  case "$password" in
    *[!0-9a-f]*) echo "not hex: $password" >&2; return 1 ;;
  esac
  assert_output_contains "Added to $ENV_FILE: KERGHAN_DEFAULT_USER_ENABLED KERGHAN_DEFAULT_USER_USERNAME KERGHAN_DEFAULT_USER_EMAIL KERGHAN_DEFAULT_USER_PASSWORD KERGHAN_DEFAULT_USER_ADMIN"
  assert_output_contains "Run 'kerghan down && kerghan up' to apply the change."
  assert_output_contains "password of the 'admin' user"
  refute_value_printed "$password"
  [ "$(grep -c 'KERGHAN_DEFAULT_USER_ALWAYS_AUTHENTICATED' "$ENV_FILE")" -eq 0 ]
  [ "$(grep -c 'KERGHAN_DEFAULT_USER_ALLOWED_IPS' "$ENV_FILE")" -eq 0 ]
  refute_logged_prefix "docker"
  refute_logged_prefix "vault"
}

@test "only the absent keys are appended; existing lines stay first and unchanged" {
  write_legacy_env_file "# my settings" "KERGHAN_DEFAULT_USER_USERNAME=bob" "KERGHAN_LOG_LEVEL=debug"
  cp "$ENV_FILE" "$TEST_ROOT/before"
  run "$KERGHAN" update-env
  [ "$status" -eq 0 ]
  before_lines="$(wc -l <"$TEST_ROOT/before")"
  [ "$(head -n "$before_lines" "$ENV_FILE")" = "$(cat "$TEST_ROOT/before")" ]
  [ "$(tail -n +"$((before_lines + 1))" "$ENV_FILE" | sed 's/=.*//' | tr '\n' ' ')" = "KERGHAN_DEFAULT_USER_ENABLED KERGHAN_DEFAULT_USER_EMAIL KERGHAN_DEFAULT_USER_PASSWORD KERGHAN_DEFAULT_USER_ADMIN " ]
  [ "$(grep -c 'KERGHAN_DEFAULT_USER_USERNAME' "$ENV_FILE")" -eq 1 ]
  grep -qx 'KERGHAN_DEFAULT_USER_USERNAME=bob' "$ENV_FILE"
  assert_output_contains "Added to $ENV_FILE: KERGHAN_DEFAULT_USER_ENABLED KERGHAN_DEFAULT_USER_EMAIL KERGHAN_DEFAULT_USER_PASSWORD KERGHAN_DEFAULT_USER_ADMIN"
}

@test "a missing secret is generated with openssl rand -base64 32" {
  mkdir -p "$HOME/.kerghan"
  printf '%s\n' "KERGHAN_SECRET_KEY=existing-secret" "KERGHAN_DEFAULT_USER_ENABLED=true" \
    "KERGHAN_DEFAULT_USER_USERNAME=admin" "KERGHAN_DEFAULT_USER_EMAIL=admin@kerghan.local" \
    "KERGHAN_DEFAULT_USER_PASSWORD=existing-password" "KERGHAN_DEFAULT_USER_ADMIN=true" >"$ENV_FILE"
  chmod 600 "$ENV_FILE"
  run "$KERGHAN" update-env
  [ "$status" -eq 0 ]
  assert_logged "openssl rand -base64 32"
  [ "$(grep -c '^openssl rand' "$STUB_LOG")" -eq 1 ]
  [ "$(tail -n 1 "$ENV_FILE")" = "KERGHAN_INTEGRATIONS_KEY=fake-key-1" ]
  grep -qx 'KERGHAN_SECRET_KEY=existing-secret' "$ENV_FILE"
  assert_output_contains "Added to $ENV_FILE: KERGHAN_INTEGRATIONS_KEY"
  refute_value_printed "fake-key-1"
  [[ "$output" != *"password of the 'admin' user"* ]]
}

@test "blank keys are warned about and left as they are" {
  write_legacy_env_file "KERGHAN_DEFAULT_USER_PASSWORD=" "KERGHAN_DEFAULT_USER_EMAIL"
  run "$KERGHAN" update-env
  [ "$status" -eq 0 ]
  assert_output_contains "kerghan: warning: $ENV_FILE has a blank KERGHAN_DEFAULT_USER_PASSWORD; left as it is"
  assert_output_contains "kerghan: warning: $ENV_FILE has a blank KERGHAN_DEFAULT_USER_EMAIL; left as it is"
  assert_output_contains "still treats the default user as missing"
  [ "$(grep -c 'KERGHAN_DEFAULT_USER_PASSWORD' "$ENV_FILE")" -eq 1 ]
  [ "$(grep -c 'KERGHAN_DEFAULT_USER_EMAIL' "$ENV_FILE")" -eq 1 ]
  grep -qx 'KERGHAN_DEFAULT_USER_PASSWORD=' "$ENV_FILE"
  grep -qx 'KERGHAN_DEFAULT_USER_EMAIL' "$ENV_FILE"
  refute_logged_prefix "openssl rand -hex"
  assert_output_contains "Added to $ENV_FILE: KERGHAN_DEFAULT_USER_ENABLED KERGHAN_DEFAULT_USER_USERNAME KERGHAN_DEFAULT_USER_ADMIN"
}

@test "a blank key that is not a credential is warned about without the default-user hint" {
  write_env_file
  sed -i 's/^KERGHAN_DEFAULT_USER_ADMIN=true$/KERGHAN_DEFAULT_USER_ADMIN=/' "$ENV_FILE"
  run "$KERGHAN" update-env
  [ "$status" -eq 0 ]
  assert_output_contains "has a blank KERGHAN_DEFAULT_USER_ADMIN; left as it is"
  [[ "$output" != *"still treats the default user as missing"* ]]
  assert_output_contains "nothing was added"
}

@test "an indented key counts as present and is not duplicated" {
  write_legacy_env_file "  KERGHAN_DEFAULT_USER_ADMIN=false"
  run "$KERGHAN" update-env
  [ "$status" -eq 0 ]
  [ "$(grep -c 'KERGHAN_DEFAULT_USER_ADMIN' "$ENV_FILE")" -eq 1 ]
  grep -qx '  KERGHAN_DEFAULT_USER_ADMIN=false' "$ENV_FILE"
  [[ "$output" != *"KERGHAN_DEFAULT_USER_ADMIN"* ]]
}

@test "a file without a trailing newline gets one before the appended keys" {
  mkdir -p "$HOME/.kerghan"
  printf 'KERGHAN_SECRET_KEY=existing-secret\nKERGHAN_INTEGRATIONS_KEY=existing-integrations' >"$ENV_FILE"
  chmod 600 "$ENV_FILE"
  run "$KERGHAN" update-env
  [ "$status" -eq 0 ]
  [ "$(sed -n 2p "$ENV_FILE")" = "KERGHAN_INTEGRATIONS_KEY=existing-integrations" ]
  [ "$(sed -n 3p "$ENV_FILE")" = "KERGHAN_DEFAULT_USER_ENABLED=true" ]
  [ "$(wc -l <"$ENV_FILE")" -eq 7 ]
}

@test "the file keeps mode 600 and its inode" {
  write_legacy_env_file
  before_inode="$(stat -c %i "$ENV_FILE")"
  run "$KERGHAN" update-env
  [ "$status" -eq 0 ]
  [ "$(stat -c %a "$ENV_FILE")" = "600" ]
  [ "$(stat -c %i "$ENV_FILE")" = "$before_inode" ]
}

@test "a symlinked kerghan.env gets the missing keys in its target and stays a symlink" {
  mkdir -p "$HOME/.kerghan" "$TEST_ROOT/dotfiles"
  printf 'KERGHAN_SECRET_KEY=existing-secret\nKERGHAN_INTEGRATIONS_KEY=existing-integrations\n' \
    >"$TEST_ROOT/dotfiles/kerghan.env"
  chmod 600 "$TEST_ROOT/dotfiles/kerghan.env"
  ln -s "$TEST_ROOT/dotfiles/kerghan.env" "$ENV_FILE"
  run "$KERGHAN" update-env
  [ "$status" -eq 0 ]
  [ -L "$ENV_FILE" ]
  [ "$(sed -n 1p "$TEST_ROOT/dotfiles/kerghan.env")" = "KERGHAN_SECRET_KEY=existing-secret" ]
  grep -qx 'KERGHAN_DEFAULT_USER_USERNAME=admin' "$TEST_ROOT/dotfiles/kerghan.env"
  [ "$(wc -l <"$TEST_ROOT/dotfiles/kerghan.env")" -eq 7 ]
  [ "$(file_mode "$TEST_ROOT/dotfiles/kerghan.env")" = "600" ]
  [ "$(ls -A "$TEST_ROOT/dotfiles")" = "kerghan.env" ]
  [ "$(ls -A "$HOME/.kerghan")" = "kerghan.env" ]
}

@test "a failed write leaves kerghan.env untouched and no temp file" {
  write_legacy_env_file
  cp "$ENV_FILE" "$TEST_ROOT/before"
  cp "$BATS_TEST_DIRNAME/stubs/mv" "$STUB_BIN/mv"
  chmod +x "$STUB_BIN/mv"
  export STUB_MV_FAIL=1
  run "$KERGHAN" update-env
  [ "$status" -eq 1 ]
  assert_output_contains "kerghan: error: could not write $ENV_FILE; it was left unchanged"
  [[ "$output" != *"Added to"* ]]
  cmp "$ENV_FILE" "$TEST_ROOT/before"
  [ "$(ls -A "$HOME/.kerghan")" = "kerghan.env" ]
}

@test "a second run adds nothing and leaves the file byte-identical" {
  write_legacy_env_file
  run "$KERGHAN" update-env
  [ "$status" -eq 0 ]
  cp "$ENV_FILE" "$TEST_ROOT/after-first"
  : >"$STUB_LOG"
  run "$KERGHAN" update-env
  [ "$status" -eq 0 ]
  assert_output_contains "$ENV_FILE is up to date; nothing was added."
  cmp "$ENV_FILE" "$TEST_ROOT/after-first"
  refute_logged_prefix "openssl"
}

@test "update-env with an argument is a usage error" {
  write_legacy_env_file
  cp "$ENV_FILE" "$TEST_ROOT/before"
  run "$KERGHAN" update-env --foo
  [ "$status" -eq 2 ]
  assert_output_contains "kerghan: error: unknown option '--foo'"
  assert_output_contains "Usage: kerghan"
  cmp "$ENV_FILE" "$TEST_ROOT/before"
}

@test "an invalid config fails update-env without touching kerghan.env" {
  write_legacy_env_file
  cp "$ENV_FILE" "$TEST_ROOT/before"
  write_config "port=abc"
  run "$KERGHAN" update-env
  [ "$status" -eq 1 ]
  assert_output_contains "invalid port 'abc'"
  cmp "$ENV_FILE" "$TEST_ROOT/before"
}

@test "help lists update-env" {
  run "$KERGHAN" help
  [ "$status" -eq 0 ]
  assert_output_contains "update-env                      add missing variables to ~/.kerghan/kerghan.env (keeps existing values)"
}
