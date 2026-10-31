#!/usr/bin/env bats
# kerghan configure: secret handling (docs/agents/standalone/client-config.md,
# "Security"): masking, inline secrets, --force, cross-key warnings, the
# password note, file safety and the Docker footprint.

load helpers/setup

# --- masking ---

@test "the listing masks the secrets, the single read prints (set), --show-secrets shows them" {
  write_env_file
  run "$KERGHAN" configure
  [ "$status" -eq 0 ]
  refute_output_contains "existing-secret"
  refute_output_contains "existing-integrations"
  refute_output_contains "existing-password"
  [ "$(printf '%s\n' "$output" | grep -c '\*\*\*\*\*\*\*\*')" -eq 3 ]
  for key in KERGHAN_SECRET_KEY KERGHAN_INTEGRATIONS_KEY KERGHAN_DEFAULT_USER_PASSWORD; do
    run "$KERGHAN" configure "$key"
    [ "$status" -eq 0 ]
    [ "$output" = "******** (set)" ]
  done
  run "$KERGHAN" configure --show-secrets KERGHAN_SECRET_KEY
  [ "$output" = "existing-secret" ]
  run "$KERGHAN" configure --show-secrets
  assert_output_contains "existing-integrations"
  assert_output_contains "existing-password-0123456789abcdef"
}

@test "setting the password prints changed and never the old or new value" {
  write_env_file
  run "$KERGHAN" configure KERGHAN_DEFAULT_USER_PASSWORD=brand-new-password
  [ "$status" -eq 0 ]
  assert_output_contains "KERGHAN_DEFAULT_USER_PASSWORD: changed"
  refute_output_contains "brand-new-password"
  refute_output_contains "existing-password"
  grep -qx 'KERGHAN_DEFAULT_USER_PASSWORD=brand-new-password' "$ENV_FILE"
}

@test "a password-length error does not contain the value" {
  write_env_file
  run "$KERGHAN" configure KERGHAN_DEFAULT_USER_PASSWORD=short12
  [ "$status" -eq 1 ]
  assert_output_contains "KERGHAN_DEFAULT_USER_PASSWORD"
  assert_output_contains "at least 8 characters"
  refute_output_contains "short12"
}

# --- inline secrets ---

@test "an inline password prints the KEY=- hint and still writes" {
  write_env_file
  run "$KERGHAN" configure KERGHAN_DEFAULT_USER_PASSWORD=inline-password
  [ "$status" -eq 0 ]
  assert_output_contains "kerghan: hint:"
  assert_output_contains "KERGHAN_DEFAULT_USER_PASSWORD=-"
  grep -qx 'KERGHAN_DEFAULT_USER_PASSWORD=inline-password' "$ENV_FILE"
}

# --- changing the secrets ---

@test "KERGHAN_SECRET_KEY without --force exits 1 and writes nothing" {
  write_env_file
  cp "$ENV_FILE" "$TEST_ROOT/before"
  run "$KERGHAN" configure KERGHAN_SECRET_KEY=x port=3002
  [ "$status" -eq 1 ]
  cmp "$ENV_FILE" "$TEST_ROOT/before"
  [ ! -e "$CONFIG_FILE" ]
}

@test "--force without a TTY prints the warning and writes" {
  write_env_file
  run bash -c "'$KERGHAN' configure --force KERGHAN_SECRET_KEY=new-secret </dev/null"
  [ "$status" -eq 0 ]
  assert_output_contains "kerghan: warning: changing KERGHAN_SECRET_KEY logs everyone out"
  assert_output_contains "back up"
  refute_output_contains "Continue?"
  grep -qx 'KERGHAN_SECRET_KEY=new-secret' "$ENV_FILE"
  assert_output_contains "KERGHAN_SECRET_KEY: changed"
}

@test "--force on a TTY answered n exits 1 and writes nothing" {
  write_env_file
  cp "$ENV_FILE" "$TEST_ROOT/before"
  export KERGHAN_ASSUME_TTY=true
  run bash -c "printf 'n\n' | '$KERGHAN' configure --force KERGHAN_INTEGRATIONS_KEY=new-key"
  [ "$status" -eq 1 ]
  assert_output_contains "Continue? [y/N]"
  assert_output_contains "unreadable"
  cmp "$ENV_FILE" "$TEST_ROOT/before"
}

@test "--force on a TTY answered y writes" {
  write_env_file
  export KERGHAN_ASSUME_TTY=true
  run bash -c "printf 'y\n' | '$KERGHAN' configure --force KERGHAN_SECRET_KEY=new-secret"
  [ "$status" -eq 0 ]
  grep -qx 'KERGHAN_SECRET_KEY=new-secret' "$ENV_FILE"
}

# --- cross-key warnings ---

@test "auto-login=true with bind=0.0.0.0 writes both and prints the non-loopback warning" {
  write_env_file
  run "$KERGHAN" configure auto-login=true bind=0.0.0.0
  [ "$status" -eq 0 ]
  [ "$(cat "$CONFIG_FILE")" = "auto-login=true
bind=0.0.0.0" ]
  assert_output_contains "kerghan: warning: automatic login is on and the port is published on 0.0.0.0: anyone who can reach it is logged in as admin"
  assert_output_contains "bind=127.0.0.1"
}

@test "auto-login=true without the default user writes and warns that up will fail" {
  write_legacy_env_file
  run "$KERGHAN" configure auto-login=true
  [ "$status" -eq 0 ]
  [ "$(cat "$CONFIG_FILE")" = "auto-login=true" ]
  assert_output_contains "'kerghan up' will fail"
  assert_output_contains "kerghan update-env"
}

@test "auto-login=true with the three credentials in the same call does not warn" {
  write_legacy_env_file
  run "$KERGHAN" configure auto-login=true KERGHAN_DEFAULT_USER_USERNAME=admin \
    KERGHAN_DEFAULT_USER_EMAIL=admin@kerghan.local KERGHAN_DEFAULT_USER_PASSWORD=long-enough-pw
  [ "$status" -eq 0 ]
  refute_output_contains "will fail"
}

# --- password change ---

@test "a password change adds the sessions-revoked note to the apply hint" {
  write_env_file
  run bash -c "printf 'another-password\n' | '$KERGHAN' configure KERGHAN_DEFAULT_USER_PASSWORD=-"
  [ "$status" -eq 0 ]
  assert_output_contains "Run 'kerghan down && kerghan up' to apply."
  assert_output_contains "admin password changes and the default user's existing sessions are revoked"
}

# --- file safety ---

@test "the written kerghan.env is mode 600" {
  write_env_file
  chmod 644 "$ENV_FILE"
  run "$KERGHAN" configure MY_VAR=1
  [ "$status" -eq 0 ]
  [ "$(file_mode "$ENV_FILE")" = "600" ]
}

@test "a write failing after the temp file is created leaves no temp file" {
  write_env_file
  cp "$ENV_FILE" "$TEST_ROOT/before"
  cp "$BATS_TEST_DIRNAME/stubs/mv" "$STUB_BIN/mv"
  chmod +x "$STUB_BIN/mv"
  export STUB_MV_FAIL=1
  run "$KERGHAN" configure KERGHAN_DEFAULT_USER_PASSWORD=never-written
  [ "$status" -eq 1 ]
  assert_logged_prefix "mv "
  cmp "$ENV_FILE" "$TEST_ROOT/before"
  [ "$(ls -A "$HOME/.kerghan")" = "kerghan.env" ]
}

# --- Docker footprint ---

@test "with kerghan.env present, configure calls neither docker nor vault" {
  write_env_file
  run "$KERGHAN" configure
  run "$KERGHAN" configure KERGHAN_DEFAULT_USER_PASSWORD
  run "$KERGHAN" configure KERGHAN_DEFAULT_USER_PASSWORD=yet-another-pw port=3002
  run "$KERGHAN" configure --unset port
  refute_logged_prefix "docker"
  refute_logged_prefix "vault"
}

# assert_logged_prefix <prefix> - a STUB_LOG line starts with <prefix>.
assert_logged_prefix() {
  if ! grep -q "^$1" "$STUB_LOG"; then
    echo "expected a stub call starting with: $1" >&2
    cat "$STUB_LOG" >&2
    return 1
  fi
}
