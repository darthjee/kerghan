#!/usr/bin/env bats
# kerghan configure: the command (docs/agents/specs/client-config/
# configure.md): usage errors, list, single read, write, KEY=-, --unset and
# refused keys.

load helpers/setup

# list_row <key> - the listing row of <key>, spaces squeezed.
list_row() {
  printf '%s\n' "$output" | grep -E "^  $1 " | tr -s ' '
}

# --- list ---

@test "the listing without files shows the defaults and the env section as not created" {
  run "$KERGHAN" configure
  [ "$status" -eq 0 ]
  [ "${lines[0]}" = "config (~/.kerghan/config)" ]
  [ "$(list_row port)" = " port 3000 default" ]
  [ "$(list_row variant)" = " variant online default" ]
  [ "$(list_row runtime)" = " runtime auto default" ]
  [ "$(list_row stop-timeout)" = " stop-timeout 60 default" ]
  [ "$(list_row image-tag)" = " image-tag $CURRENT_VERSION default" ]
  [ "$(list_row auto-login)" = " auto-login true default" ]
  [ "$(list_row bind)" = " bind 127.0.0.1 derived (auto-login on)" ]
  [ "${lines[8]}" = "env (~/.kerghan/kerghan.env)" ]
  assert_output_contains "not created yet"
  [ "${#lines[@]}" -eq 10 ]
  [ ! -e "$HOME/.kerghan" ]
}

@test "the listing shows each source where it applies" {
  write_env_file "KERGHAN_DEFAULT_USER_ALLOWED_IPS=1.2.3.4" "FROM_HOST" "MY_CUSTOM_VAR=hello"
  write_config "port=3001" "runtime=sysbox2" "auto-login=false" "colour=blue"
  run "$KERGHAN" configure
  [ "$status" -eq 0 ]
  [ "$(list_row port)" = " port 3001 file" ]
  [ "$(list_row variant)" = " variant online default" ]
  [ "$(list_row runtime)" = " runtime sysbox2 file, invalid" ]
  [ "$(list_row bind)" = " bind 0.0.0.0 derived (auto-login off)" ]
  [ "$(list_row colour)" = " colour blue unknown (ignored)" ]
  [ "$(list_row FRONTEND_BASE_URL)" = " FRONTEND_BASE_URL — not set" ]
  [ "$(list_row FROM_HOST)" = " FROM_HOST — file, from environment" ]
  [ "$(list_row KERGHAN_DEFAULT_USER_ALLOWED_IPS)" = " KERGHAN_DEFAULT_USER_ALLOWED_IPS 1.2.3.4 file, refused (client-managed)" ]
  [ "$(list_row MY_CUSTOM_VAR)" = " MY_CUSTOM_VAR hello file" ]
}

@test "the env rows follow DEFAULT_ENV_KEYS, then FRONTEND_BASE_URL, then file order" {
  write_env_file "ZED=1" "ALPHA=2"
  run "$KERGHAN" configure
  [ "$status" -eq 0 ]
  [ "$(printf '%s\n' "$output" | sed -n '/^env /,$p' | awk 'NR > 1 { print $1 }' | tr '\n' ' ')" = "KERGHAN_SECRET_KEY KERGHAN_INTEGRATIONS_KEY KERGHAN_DEFAULT_USER_ENABLED KERGHAN_DEFAULT_USER_USERNAME KERGHAN_DEFAULT_USER_EMAIL KERGHAN_DEFAULT_USER_PASSWORD KERGHAN_DEFAULT_USER_ADMIN FRONTEND_BASE_URL ZED ALPHA " ]
}

@test "the listing aligns the columns" {
  write_env_file
  run "$KERGHAN" configure
  [ "$status" -eq 0 ]
  [ "$(printf '%s\n' "$output" | grep -E '^  (port|stop-timeout) ' | awk '{ print index($0, $2) }' | sort -u | wc -l)" -eq 1 ]
}

@test "a config line without = is reported as a warning and the listing still prints" {
  write_env_file
  write_config "port=3001" "oops"
  run "$KERGHAN" configure
  [ "$status" -eq 0 ]
  assert_output_contains "kerghan: warning: $CONFIG_FILE:2: expected key=value"
  [ "$(list_row port)" = " port 3001 file" ]
}

@test "auto-login without a default user in kerghan.env is derived false" {
  write_legacy_env_file
  run "$KERGHAN" configure
  [ "$status" -eq 0 ]
  [ "$(list_row auto-login)" = " auto-login false derived (no default user in kerghan.env)" ]
  [ "$(list_row bind)" = " bind 0.0.0.0 derived (auto-login off)" ]
}

@test "the listing masks the password and both secrets; --show-secrets shows them" {
  write_env_file
  run "$KERGHAN" configure
  [ "$status" -eq 0 ]
  [ "$(list_row KERGHAN_SECRET_KEY)" = " KERGHAN_SECRET_KEY ******** file" ]
  [ "$(list_row KERGHAN_INTEGRATIONS_KEY)" = " KERGHAN_INTEGRATIONS_KEY ******** file" ]
  [ "$(list_row KERGHAN_DEFAULT_USER_PASSWORD)" = " KERGHAN_DEFAULT_USER_PASSWORD ******** file" ]
  refute_output_contains "existing-secret"
  run "$KERGHAN" configure --show-secrets
  [ "$status" -eq 0 ]
  [ "$(list_row KERGHAN_SECRET_KEY)" = " KERGHAN_SECRET_KEY existing-secret file" ]
  [ "$(list_row KERGHAN_INTEGRATIONS_KEY)" = " KERGHAN_INTEGRATIONS_KEY existing-integrations file" ]
  [ "$(list_row KERGHAN_DEFAULT_USER_PASSWORD)" = " KERGHAN_DEFAULT_USER_PASSWORD existing-password-0123456789abcdef file" ]
}

# --- single read ---

@test "a single read prints the file value, or an empty line without one" {
  write_env_file
  write_config "port=3001"
  run "$KERGHAN" configure port
  [ "$status" -eq 0 ]
  [ "$output" = "3001" ]
  write_config "variant=online"
  run "$KERGHAN" configure port
  [ "$status" -eq 0 ]
  [ "$output" = "" ]
}

@test "a single read masks a set secret" {
  write_env_file
  run "$KERGHAN" configure KERGHAN_DEFAULT_USER_PASSWORD
  [ "$status" -eq 0 ]
  [ "$output" = "******** (set)" ]
}

@test "a single read of an unknown lower-case key exits 1" {
  write_env_file
  run "$KERGHAN" configure portt
  [ "$status" -eq 1 ]
  assert_output_contains "unknown key 'portt'"
}

@test "a single read of an unknown upper-case key prints an empty line" {
  write_env_file
  run "$KERGHAN" configure NOT_THERE
  [ "$status" -eq 0 ]
  [ "$output" = "" ]
}

# --- write ---

@test "port=3002 writes the line, prints the change and the up hint" {
  write_env_file
  run "$KERGHAN" configure port=3002
  [ "$status" -eq 0 ]
  [ "$(cat "$CONFIG_FILE")" = "port=3002" ]
  [ "${lines[0]}" = "port: 3000 (default) -> 3002" ]
  [ "${lines[1]}" = "Run 'kerghan up' to apply (recreates the instance; data is kept)." ]
}

@test "several config keys are written together" {
  write_env_file
  run "$KERGHAN" configure port=3002 auto-login=false
  [ "$status" -eq 0 ]
  [ "$(cat "$CONFIG_FILE")" = "port=3002
auto-login=false" ]
}

@test "one invalid value writes nothing" {
  write_env_file
  write_config "variant=online"
  cp "$CONFIG_FILE" "$TEST_ROOT/before"
  run "$KERGHAN" configure port=3002 runtime=bad
  [ "$status" -eq 1 ]
  assert_output_contains "invalid runtime 'bad'"
  cmp "$CONFIG_FILE" "$TEST_ROOT/before"
}

@test "every problem of the call is reported" {
  write_env_file
  run "$KERGHAN" configure port=0 runtime=bad
  [ "$status" -eq 1 ]
  assert_output_contains "invalid port '0'"
  assert_output_contains "invalid runtime 'bad'"
}

@test "a call setting a config key and an env key writes both files" {
  write_env_file
  run "$KERGHAN" configure port=3002 MY_VAR=1
  [ "$status" -eq 0 ]
  [ "$(cat "$CONFIG_FILE")" = "port=3002" ]
  grep -qx 'MY_VAR=1' "$ENV_FILE"
}

@test "a value is split at the first =" {
  write_env_file
  run "$KERGHAN" configure "FRONTEND_BASE_URL=https://a.example/?x=1"
  [ "$status" -eq 0 ]
  grep -qx 'FRONTEND_BASE_URL=https://a.example/?x=1' "$ENV_FILE"
}

@test "KEY=- reads the first line of piped stdin without its newline" {
  write_env_file
  run bash -c "printf 'secret-pw\n' | '$KERGHAN' configure KERGHAN_DEFAULT_USER_PASSWORD=-"
  [ "$status" -eq 0 ]
  grep -qx 'KERGHAN_DEFAULT_USER_PASSWORD=secret-pw' "$ENV_FILE"
  refute_output_contains "shell history"
}

@test "KEY=- with empty stdin is rejected" {
  write_env_file
  cp "$ENV_FILE" "$TEST_ROOT/before"
  run bash -c "'$KERGHAN' configure KERGHAN_DEFAULT_USER_PASSWORD=- </dev/null"
  [ "$status" -eq 1 ]
  cmp "$ENV_FILE" "$TEST_ROOT/before"
}

@test "KEY=- on a TTY asks twice and repeats on a mismatch" {
  write_env_file
  export KERGHAN_ASSUME_TTY=true
  run bash -c "printf 'one-value\nother\nnew-password\nnew-password\n' | '$KERGHAN' configure KERGHAN_DEFAULT_USER_PASSWORD=-"
  [ "$status" -eq 0 ]
  assert_output_contains "do not match"
  grep -qx 'KERGHAN_DEFAULT_USER_PASSWORD=new-password' "$ENV_FILE"
  refute_output_contains "new-password"
}

@test "--unset port removes the line and shows the default" {
  write_env_file
  write_config "port=3002"
  run "$KERGHAN" configure --unset port
  [ "$status" -eq 0 ]
  [ ! -s "$CONFIG_FILE" ]
  [ "${lines[0]}" = "port: 3002 -> 3000 (default)" ]
}

# --- refused keys ---

@test "setting a client-managed key is refused with the auto-login / bind hint" {
  write_env_file
  cp "$ENV_FILE" "$TEST_ROOT/before"
  for key in KERGHAN_DEFAULT_USER_ALWAYS_AUTHENTICATED KERGHAN_DEFAULT_USER_ALLOWED_IPS; do
    run "$KERGHAN" configure "$key=true"
    [ "$status" -eq 1 ]
    assert_output_contains "use auto-login (--[no-]auto-login) and bind (--bind) instead"
  done
  cmp "$ENV_FILE" "$TEST_ROOT/before"
}

@test "--unset of a client-managed key removes it" {
  write_env_file "KERGHAN_DEFAULT_USER_ALWAYS_AUTHENTICATED=true" "KERGHAN_DEFAULT_USER_ALLOWED_IPS=1.2.3.4"
  run "$KERGHAN" configure --unset KERGHAN_DEFAULT_USER_ALWAYS_AUTHENTICATED --unset KERGHAN_DEFAULT_USER_ALLOWED_IPS
  [ "$status" -eq 0 ]
  ! grep -q 'KERGHAN_DEFAULT_USER_ALWAYS_AUTHENTICATED' "$ENV_FILE"
  ! grep -q 'KERGHAN_DEFAULT_USER_ALLOWED_IPS' "$ENV_FILE"
}

@test "KERGHAN_SECRET_KEY=x without --force exits 1" {
  write_env_file
  run "$KERGHAN" configure KERGHAN_SECRET_KEY=x
  [ "$status" -eq 1 ]
  assert_output_contains "--force"
  grep -qx 'KERGHAN_SECRET_KEY=existing-secret' "$ENV_FILE"
}

# --- usage errors ---

@test "usage errors exit 2 and print usage" {
  write_env_file
  local args
  for args in "--bogus" "--unset" "--unset port=1" "port variant" "port port=1" \
    "--show-secrets port=1" "--force port" "--force" "port=1 port=2" "port=1 --unset port" \
    "MY_A=- MY_B=-" "Port=1" "Port"; do
    # shellcheck disable=SC2086 # split on purpose
    run "$KERGHAN" configure $args
    if [ "$status" -ne 2 ]; then
      echo "configure $args: exit $status" >&2
      return 1
    fi
    assert_output_contains "Usage: kerghan"
  done
  [ ! -e "$CONFIG_FILE" ]
}

@test "the usage documents configure" {
  run "$KERGHAN" help
  [ "$status" -eq 0 ]
  assert_output_contains "  configure [--show-secrets] [KEY]
                                  list the settings in ~/.kerghan/config and kerghan.env, or print KEY
  configure [--force] [--unset KEY]... [KEY=VALUE | KEY=-]...
                                  set or unset settings (all or nothing); KEY=- reads the value hidden"
}

@test "options and arguments may come in any order" {
  write_env_file
  run "$KERGHAN" configure port=3002 --unset MY_VAR --force variant=offline
  [ "$status" -eq 0 ]
  run "$KERGHAN" configure port --show-secrets
  [ "$status" -eq 0 ]
  [ "$output" = "3002" ]
}

@test "no configure call runs vault" {
  write_env_file
  run "$KERGHAN" configure
  run "$KERGHAN" configure port
  run "$KERGHAN" configure port=3002 MY_VAR=1
  run "$KERGHAN" configure --unset port
  [ -z "$(vault_calls)" ]
}
