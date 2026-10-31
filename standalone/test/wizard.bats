#!/usr/bin/env bats
# kerghan wizard (docs/agents/specs/client-config/wizard.md): the questions,
# the prompts, the password, the starting state, the summary and
# confirmation, and the abort paths. Driven through stdin with the test-only
# KERGHAN_ASSUME_TTY=true override; prompts are on stderr.

bats_require_minimum_version 1.5.0

load helpers/setup

# run_wizard <input> [args...] - runs `kerghan wizard [args]` with <input>
# (printf %b: \n separates the answers) on stdin, as a terminal.
run_wizard() {
  local input="$1"
  shift
  # shellcheck disable=SC2016 # expanded by the inner bash
  run --separate-stderr bash -c \
    'printf "%b" "$1" | KERGHAN_ASSUME_TTY=true "$2" wizard "${@:3}"' \
    _ "$input" "$KERGHAN" ${@+"$@"}
}

# prompts - the question labels on stderr, in order, comma-separated.
prompts() {
  printf '%s' "$stderr" |
    grep -oE 'Port \[|Image variant|Docker runtime|Stop timeout|Image tag|Automatic login|Bind address|Default user enabled|Default user is admin|Default user username|Default user email|Default user password|Public URL' |
    sed 's/ \[$//' | paste -sd, -
}

# assert_stderr_contains <text>
assert_stderr_contains() {
  case "$stderr" in
    *"$1"*) ;;
    *)
      echo "expected stderr to contain: $1" >&2
      echo "--- stderr ---" >&2
      echo "$stderr" >&2
      return 1
      ;;
  esac
}

# refute_stderr_contains <text>
refute_stderr_contains() {
  case "$stderr" in
    *"$1"*)
      echo "expected stderr not to contain: $1" >&2
      echo "--- stderr ---" >&2
      echo "$stderr" >&2
      return 1
      ;;
  esac
}

# snapshot - copies both files aside, for unchanged_files.
snapshot() {
  cp "$ENV_FILE" "$TEST_ROOT/env.before"
  cp "$CONFIG_FILE" "$TEST_ROOT/config.before"
}

# unchanged_files - both files are byte for byte as snapshot saw them.
unchanged_files() {
  cmp "$ENV_FILE" "$TEST_ROOT/env.before"
  cmp "$CONFIG_FILE" "$TEST_ROOT/config.before"
}

DEFAULT_ORDER="Port,Image variant,Automatic login,Bind address,Default user username,Default user email,Default user password"
ADVANCED_ORDER="Port,Image variant,Docker runtime,Stop timeout,Image tag,Automatic login,Bind address,Default user enabled,Default user is admin,Default user username,Default user email,Default user password,Public URL"

# --- arguments and starting state ---

@test "without a terminal on stdin it exits 1, points to configure and asks nothing" {
  write_env_file
  run --separate-stderr bash -c "printf '\n\n' | '$KERGHAN' wizard"
  [ "$status" -eq 1 ]
  assert_stderr_contains "kerghan configure"
  refute_stderr_contains "Port ["
  [ ! -e "$CONFIG_FILE" ]
}

@test "an unknown option or an argument exits 2" {
  write_env_file
  run_wizard "" --verbose
  [ "$status" -eq 2 ]
  assert_stderr_contains "unknown option '--verbose'"
  run_wizard "" port
  [ "$status" -eq 2 ]
  refute_stderr_contains "Port ["
}

@test "the usage lists the wizard line" {
  run "$KERGHAN" help
  assert_output_contains "  wizard [--advanced]             set up the settings interactively (--advanced asks every setting)"
}

@test "a config line without = exits 1 with the line number and asks nothing" {
  write_env_file
  write_config "port=3000" "garbage"
  run_wizard "\n\n\n\n\n\n\n"
  [ "$status" -eq 1 ]
  assert_stderr_contains "$CONFIG_FILE:2: expected key=value"
  assert_stderr_contains "by hand"
  refute_stderr_contains "Port ["
}

# --- questions ---

@test "without --advanced it asks questions 1, 2, 6, 7, 10, 11, 12 in that order" {
  write_env_file
  run_wizard "\n\n\n\n\n\n\n"
  [ "$status" -eq 0 ]
  [ "$(prompts)" = "$DEFAULT_ORDER" ]
}

@test "with --advanced it asks all thirteen in table order" {
  write_env_file
  run_wizard "\n\n\n\n\n\n\n\n\n\n\n\n\n" --advanced
  [ "$status" -eq 0 ]
  [ "$(prompts)" = "$ADVANCED_ORDER" ]
  [ "$output" = "Nothing changed." ]
}

@test "the secrets, the client-managed pair and custom keys are never asked" {
  write_env_file "MY_CUSTOM=1"
  run_wizard "\n\n\n\n\n\n\n\n\n\n\n\n\n" --advanced
  [ "$status" -eq 0 ]
  refute_stderr_contains "KERGHAN_SECRET_KEY"
  refute_stderr_contains "KERGHAN_INTEGRATIONS_KEY"
  refute_stderr_contains "ALWAYS_AUTHENTICATED"
  refute_stderr_contains "ALLOWED_IPS"
  refute_stderr_contains "MY_CUSTOM"
}

@test "Enter on every question with no config writes nothing and prints Nothing changed." {
  write_env_file
  cp "$ENV_FILE" "$TEST_ROOT/env.before"
  run_wizard "\n\n\n\n\n\n\n"
  [ "$status" -eq 0 ]
  [ "$output" = "Nothing changed." ]
  refute_stderr_contains "Write these changes?"
  [ ! -e "$CONFIG_FILE" ]
  cmp "$ENV_FILE" "$TEST_ROOT/env.before"
}

@test "port 3002 and a confirmation write port=3002, the change list and the up hint" {
  write_env_file
  run_wizard "3002\n\n\n\n\n\n\n\n"
  [ "$status" -eq 0 ]
  [ "$(cat "$CONFIG_FILE")" = "port=3002" ]
  assert_output_contains "port: 3000 (default) -> 3002"
  assert_output_contains "Run 'kerghan up' to apply (recreates the instance; data is kept)."
  assert_stderr_contains "Port [3000]: "
  assert_stderr_contains "Write these changes? [Y/n]"
}

@test "the bind default follows the auto-login answer and Enter writes no bind line" {
  write_env_file
  run_wizard "\n\n\n\n\n\n\n"
  assert_stderr_contains "Bind address [127.0.0.1, derived from auto-login]: "

  run_wizard "\n\nn\n\n\n\n\n\n"
  [ "$status" -eq 0 ]
  assert_stderr_contains "Bind address [0.0.0.0, derived from auto-login]: "
  [ "$(cat "$CONFIG_FILE")" = "auto-login=false" ]
  assert_output_contains "auto-login: true (default) -> false"
}

@test "a set bind is offered as its current value" {
  write_env_file
  write_config "bind=10.1.2.3"
  run_wizard "\n\n\n\n\n\n\n"
  [ "$status" -eq 0 ]
  assert_stderr_contains "Bind address [10.1.2.3]: "
}

@test "auto-login false with the default user disabled skips the default user questions" {
  write_legacy_env_file \
    "KERGHAN_DEFAULT_USER_ENABLED=false" \
    "KERGHAN_DEFAULT_USER_USERNAME=admin" \
    "KERGHAN_DEFAULT_USER_EMAIL=admin@kerghan.local" \
    "KERGHAN_DEFAULT_USER_PASSWORD=existing-password-0123456789abcdef"
  run_wizard "\n\nfalse\n\n\n"
  [ "$status" -eq 0 ]
  [ "$(prompts)" = "Port,Image variant,Automatic login,Bind address" ]
  [ "$(cat "$CONFIG_FILE")" = "auto-login=false" ]
}

@test "auto-login true with the default user disabled still asks the default user questions" {
  write_legacy_env_file \
    "KERGHAN_DEFAULT_USER_ENABLED=false" \
    "KERGHAN_DEFAULT_USER_USERNAME=admin" \
    "KERGHAN_DEFAULT_USER_EMAIL=admin@kerghan.local" \
    "KERGHAN_DEFAULT_USER_PASSWORD=existing-password-0123456789abcdef"
  run_wizard "\n\ntrue\n\n\n\n\n\n"
  [ "$status" -eq 0 ]
  [ "$(prompts)" = "$DEFAULT_ORDER" ]
}

@test "with --advanced the skip rule uses the enabled answer" {
  write_env_file
  run_wizard "\n\n\n\n\nfalse\n\nn\n\n\n" --advanced
  [ "$status" -eq 0 ]
  [ "$(prompts)" = "Port,Image variant,Docker runtime,Stop timeout,Image tag,Automatic login,Bind address,Default user enabled,Public URL" ]
  grep -qx 'KERGHAN_DEFAULT_USER_ENABLED=false' "$ENV_FILE"
  [ "$(cat "$CONFIG_FILE")" = "auto-login=false" ]
}

@test "an invalid port answer is asked again and the next valid answer is written" {
  write_env_file
  run_wizard "abc\n3002\n\n\n\n\n\n\n\n"
  [ "$status" -eq 0 ]
  assert_stderr_contains "kerghan: error: invalid port 'abc' (expected 1-65535)"
  [ "$(printf '%s' "$stderr" | grep -o 'Port \[3000\]' | wc -l | tr -d ' ')" -eq 2 ]
  [ "$(cat "$CONFIG_FILE")" = "port=3002" ]
}

@test "an invalid boolean answer is asked again" {
  write_env_file
  run_wizard "\n\nmaybe\nfalse\n\n\n\n\n\n"
  [ "$status" -eq 0 ]
  assert_stderr_contains "invalid auto-login 'maybe'"
  [ "$(cat "$CONFIG_FILE")" = "auto-login=false" ]
}

@test "an invalid runtime line is shown as invalid and Enter writes the default (--advanced)" {
  write_env_file
  write_config "runtime=bogus"
  run_wizard "\n\n\n\n\n\n\n\n\n\n\n\n\n\n" --advanced
  [ "$status" -eq 0 ]
  assert_stderr_contains "Docker runtime (auto/sysbox/privileged) [auto] (current value 'bogus' is invalid): "
  [ "$(cat "$CONFIG_FILE")" = "runtime=auto" ]
  assert_output_contains "runtime: bogus -> auto"
  run "$KERGHAN" configure runtime
  [ "$status" -eq 0 ]
  [ "$output" = "auto" ]
  run "$KERGHAN" configure
  refute_output_contains "invalid"
}

@test "an invalid runtime line is asked without --advanced too, so the write cannot fail" {
  write_env_file
  write_config "runtime=bogus"
  run_wizard "\n\n\n\n\n\n\n\n\n"
  [ "$status" -eq 0 ]
  [ "$(prompts)" = "Port,Image variant,Docker runtime,Automatic login,Bind address,Default user username,Default user email,Default user password" ]
  [ "$(cat "$CONFIG_FILE")" = "runtime=auto" ]
}

@test "an invalid port line offers the default and Enter writes it" {
  write_env_file
  write_config "port=abc"
  run_wizard "\n\n\n\n\n\n\n\n"
  [ "$status" -eq 0 ]
  assert_stderr_contains "Port [3000] (current value 'abc' is invalid): "
  [ "$(cat "$CONFIG_FILE")" = "port=3000" ]
}

# --- password ---

@test "password g writes 48 hex characters, never printed, and says it is in kerghan.env" {
  write_env_file
  run_wizard "\n\n\n\n\n\ng\n\n"
  [ "$status" -eq 0 ]
  local password
  password="$(sed -n 's/^KERGHAN_DEFAULT_USER_PASSWORD=//p' "$ENV_FILE")"
  [[ "$password" =~ ^[0-9a-f]{48}$ ]]
  refute_output_contains "$password"
  refute_stderr_contains "$password"
  assert_output_contains "KERGHAN_DEFAULT_USER_PASSWORD: changed (generated)"
  assert_output_contains "kerghan.env"
  assert_output_contains "admin password changes"
  [ "$(file_mode "$ENV_FILE")" = "600" ]
}

@test "password t with two matching answers writes it and the summary masks it" {
  write_env_file
  run_wizard "\n\n\n\n\n\nt\nwizard-typed-pw\nwizard-typed-pw\n\n"
  [ "$status" -eq 0 ]
  grep -qx 'KERGHAN_DEFAULT_USER_PASSWORD=wizard-typed-pw' "$ENV_FILE"
  assert_output_contains "KERGHAN_DEFAULT_USER_PASSWORD: changed"
  refute_output_contains "(generated)"
  refute_output_contains "wizard-typed-pw"
  refute_stderr_contains "wizard-typed-pw"
  refute_output_contains "existing-password"
}

@test "a typed password mismatch asks both again" {
  write_env_file
  run_wizard "\n\n\n\n\n\nt\nfirst-try-pw\nother-try-pw\nwizard-typed-pw\nwizard-typed-pw\n\n"
  [ "$status" -eq 0 ]
  assert_stderr_contains "do not match"
  [ "$(printf '%s' "$stderr" | grep -o 'New password (again)' | wc -l | tr -d ' ')" -eq 2 ]
  grep -qx 'KERGHAN_DEFAULT_USER_PASSWORD=wizard-typed-pw' "$ENV_FILE"
}

@test "a 7-character typed password is asked again and never shown" {
  write_env_file
  run_wizard "\n\n\n\n\n\nt\nshort77\nshort77\nwizard-typed-pw\nwizard-typed-pw\n\n"
  [ "$status" -eq 0 ]
  assert_stderr_contains "at least 8 characters"
  refute_stderr_contains "short77"
  refute_output_contains "short77"
  grep -qx 'KERGHAN_DEFAULT_USER_PASSWORD=wizard-typed-pw' "$ENV_FILE"
}

@test "with no password in kerghan.env keep is not offered and generate is the default" {
  write_legacy_env_file \
    "KERGHAN_DEFAULT_USER_ENABLED=true" \
    "KERGHAN_DEFAULT_USER_USERNAME=admin" \
    "KERGHAN_DEFAULT_USER_EMAIL=admin@kerghan.local"
  run_wizard "\n\n\n\n\n\n\n\n"
  [ "$status" -eq 0 ]
  assert_stderr_contains "Default user password: (g)enerate or (t)ype? [g]: "
  refute_stderr_contains "(k)eep"
  grep -qE '^KERGHAN_DEFAULT_USER_PASSWORD=[0-9a-f]{48}$' "$ENV_FILE"
}

# --- public URL ---

@test "--advanced public URL: Enter with none set writes nothing" {
  write_env_file
  cp "$ENV_FILE" "$TEST_ROOT/env.before"
  run_wizard "\n\n\n\n\n\n\n\n\n\n\n\n\n" --advanced
  [ "$status" -eq 0 ]
  assert_stderr_contains "Public URL [http://localhost:3000, derived from port]:"
  cmp "$ENV_FILE" "$TEST_ROOT/env.before"
}

@test "--advanced public URL: the default follows the port answer and an answer is written" {
  write_env_file
  run_wizard "3002\n\n\n\n\n\n\n\n\n\n\n\nhttps://kerghan.example.com\n\n" --advanced
  [ "$status" -eq 0 ]
  assert_stderr_contains "Public URL [http://localhost:3002, derived from port]:"
  grep -qx 'FRONTEND_BASE_URL=https://kerghan.example.com' "$ENV_FILE"
  assert_output_contains "FRONTEND_BASE_URL: (not set) -> https://kerghan.example.com"
  assert_output_contains "Run 'kerghan down && kerghan up' to apply."
}

@test "--advanced public URL: a set value is offered as its current value" {
  write_env_file "FRONTEND_BASE_URL=https://old.example.com"
  run_wizard "\n\n\n\n\n\n\n\n\n\n\n\n\n" --advanced
  [ "$status" -eq 0 ]
  assert_stderr_contains "Public URL [https://old.example.com]:"
  [ "$output" = "Nothing changed." ]
}

# --- confirmation and abort ---

@test "answering n prints Nothing written., exits 0 and leaves both files unchanged" {
  write_env_file
  write_config "# my settings" "port=3001"
  snapshot
  run_wizard "3002\n\n\n\n\n\ng\nn\n"
  [ "$status" -eq 0 ]
  assert_output_contains "port: 3001 -> 3002"
  assert_output_contains "KERGHAN_DEFAULT_USER_PASSWORD: changed (generated)"
  assert_output_contains "Nothing written."
  refute_output_contains "Run 'kerghan"
  unchanged_files
}

@test "end of input after question 2 writes nothing and exits 1" {
  write_env_file
  write_config "port=3001"
  snapshot
  run_wizard "3002\noffline\n"
  [ "$status" -eq 1 ]
  assert_stderr_contains "input ended"
  unchanged_files
}

@test "end of input at the confirmation writes nothing and exits 1" {
  write_env_file
  write_config "port=3001"
  snapshot
  run_wizard "3002\n\n\n\n\n\n\n"
  [ "$status" -eq 1 ]
  assert_stderr_contains "input ended"
  unchanged_files
}

# --- missing kerghan.env ---

@test "with no kerghan.env and no volume it creates the file as up does with the answers applied" {
  run_wizard "\n\n\n\n\nme@example.com\n\n\n"
  [ "$status" -eq 0 ]
  assert_stderr_contains "Default user username [admin]: "
  assert_stderr_contains "Default user email [admin@kerghan.local]: "
  assert_stderr_contains "(g)enerate or (t)ype? [g]: "
  [ "$(file_mode "$ENV_FILE")" = "600" ]
  # shellcheck disable=SC2013 # one line of space-separated keys
  for key in $(sed -n 's/^DEFAULT_ENV_KEYS="\(.*\)"$/\1/p' "$KERGHAN"); do
    grep -q "^$key=" "$ENV_FILE"
  done
  grep -qx 'KERGHAN_DEFAULT_USER_EMAIL=me@example.com' "$ENV_FILE"
  grep -qx 'KERGHAN_DEFAULT_USER_USERNAME=admin' "$ENV_FILE"
  grep -qE '^KERGHAN_DEFAULT_USER_PASSWORD=[0-9a-f]{48}$' "$ENV_FILE"
  assert_output_contains "Generated secrets in $ENV_FILE"
}

@test "with no kerghan.env and a data volume it exits 1 before the first question" {
  export STUB_VOLUME_EXISTS=1
  run_wizard "\n\n\n\n\n\n\n\n"
  [ "$status" -eq 1 ]
  assert_stderr_contains "kerghan reset"
  assert_stderr_contains "kerghan configure"
  refute_stderr_contains "Port ["
  [ ! -e "$ENV_FILE" ]
}

# --- Docker footprint ---

@test "the wizard makes no vault call, and no docker call when kerghan.env exists" {
  write_env_file
  run_wizard "3002\n\n\n\n\n\ng\n\n"
  [ "$status" -eq 0 ]
  run_wizard "3002\n\n\n\n\n\n\n\n\n\n\nt\nwizard-typed-pw\nwizard-typed-pw\n\n\n" --advanced
  [ "$status" -eq 0 ]
  refute_logged_prefix "vault"
  refute_logged_prefix "docker"
}
