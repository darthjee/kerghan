#!/usr/bin/env bats
# auto-login: precedence (flag > ~/.kerghan/config > default true), its
# translation into KERGHAN_DEFAULT_USER_ALWAYS_AUTHENTICATED, the allowlist,
# and the -e values overriding kerghan.env.

load helpers/setup

# up_line <bind> <auto-login> - the expected `vault up` line on port 3000.
up_line() {
  echo "vault up --name kerghan --image $IMAGE --env-file $ENV_FILE -p $1:3000:80 -e FRONTEND_BASE_URL=http://localhost:3000 $(default_user_args "$2") --runtime auto --stop-timeout 60"
}

@test "by default auto-login is on and the port is published on 127.0.0.1" {
  write_env_file
  run "$KERGHAN" up
  [ "$status" -eq 0 ]
  [ "$(vault_calls)" = "$(up_line 127.0.0.1 true)" ]
  [[ "$output" != *warning* ]]
}

@test "auto-login=false from the file turns it off and publishes on 0.0.0.0" {
  write_env_file
  write_config "auto-login=false"
  run "$KERGHAN" up
  [ "$status" -eq 0 ]
  [ "$(vault_calls)" = "$(up_line 0.0.0.0 false)" ]
  [[ "$output" != *warning* ]]
}

@test "auto-login=true from the file keeps it on" {
  write_env_file
  write_config "auto-login=true"
  run "$KERGHAN" up
  [ "$status" -eq 0 ]
  [ "$(vault_calls)" = "$(up_line 127.0.0.1 true)" ]
}

@test "an empty auto-login= uses the default" {
  write_env_file
  write_config "auto-login="
  run "$KERGHAN" up
  [ "$status" -eq 0 ]
  [ "$(vault_calls)" = "$(up_line 127.0.0.1 true)" ]
}

@test "--no-auto-login wins over auto-login=true" {
  write_env_file
  write_config "auto-login=true"
  run "$KERGHAN" up --no-auto-login
  [ "$status" -eq 0 ]
  [ "$(vault_calls)" = "$(up_line 0.0.0.0 false)" ]
}

@test "--auto-login wins over auto-login=false" {
  write_env_file
  write_config "auto-login=false"
  run "$KERGHAN" up --auto-login
  [ "$status" -eq 0 ]
  [ "$(vault_calls)" = "$(up_line 127.0.0.1 true)" ]
}

@test "the last of --auto-login and --no-auto-login wins" {
  write_env_file
  run "$KERGHAN" up --auto-login --no-auto-login
  [ "$status" -eq 0 ]
  [ "$(vault_calls)" = "$(up_line 0.0.0.0 false)" ]
}

@test "an invalid auto-login fails with the line number, before any side effect" {
  write_config "# settings" "auto-login=yes"
  run "$KERGHAN" up
  [ "$status" -eq 1 ]
  assert_output_contains "kerghan: error: $CONFIG_FILE:2: invalid auto-login 'yes' (expected true or false)"
  [ -z "$(vault_calls)" ]
  refute_logged_prefix "openssl"
  [ ! -e "$ENV_FILE" ]
}

@test "up refuses a kerghan.env that sets KERGHAN_DEFAULT_USER_ALWAYS_AUTHENTICATED" {
  write_env_file "KERGHAN_DEFAULT_USER_ALWAYS_AUTHENTICATED=false"
  run "$KERGHAN" up
  [ "$status" -eq 1 ]
  assert_output_contains "kerghan: error: $ENV_FILE sets KERGHAN_DEFAULT_USER_ALWAYS_AUTHENTICATED, which the client manages itself"
  assert_output_contains "kerghan: hint: remove the line(s) from kerghan.env; use auto-login"
  [ -z "$(vault_calls)" ]
  # kerghan.env is left as it is.
  grep -qx 'KERGHAN_DEFAULT_USER_ALWAYS_AUTHENTICATED=false' "$ENV_FILE"
}

@test "up refuses a kerghan.env that sets KERGHAN_DEFAULT_USER_ALLOWED_IPS" {
  write_env_file "KERGHAN_DEFAULT_USER_ALLOWED_IPS=203.0.113.7"
  run "$KERGHAN" up --no-auto-login
  [ "$status" -eq 1 ]
  assert_output_contains "kerghan: error: $ENV_FILE sets KERGHAN_DEFAULT_USER_ALLOWED_IPS, which the client manages itself"
  [ -z "$(vault_calls)" ]
}

@test "up names both client-managed keys, even indented, empty or bare" {
  write_env_file "  KERGHAN_DEFAULT_USER_ALWAYS_AUTHENTICATED=" "KERGHAN_DEFAULT_USER_ALLOWED_IPS"
  run "$KERGHAN" up
  [ "$status" -eq 1 ]
  assert_output_contains "sets KERGHAN_DEFAULT_USER_ALWAYS_AUTHENTICATED KERGHAN_DEFAULT_USER_ALLOWED_IPS, which"
  [ -z "$(vault_calls)" ]
}

@test "up refuses the client-managed keys before recreating a running instance" {
  write_env_file "KERGHAN_DEFAULT_USER_ALWAYS_AUTHENTICATED=true"
  export STUB_RUNNING_IMAGE="$IMAGE_REPO:$OLDER_VERSION"
  run "$KERGHAN" up
  [ "$status" -eq 1 ]
  [ -z "$(vault_calls)" ]
}

@test "commented-out or prefixed client-managed keys are not refused" {
  write_env_file "# KERGHAN_DEFAULT_USER_ALWAYS_AUTHENTICATED=false" \
    "MY_KERGHAN_DEFAULT_USER_ALLOWED_IPS=1.2.3.4" "KERGHAN_DEFAULT_USER_ALLOWED_IPS_NOTE=x"
  run "$KERGHAN" up
  [ "$status" -eq 0 ]
  [ "$(vault_calls)" = "$(up_line 127.0.0.1 true)" ]
}

@test "KERGHAN_DEFAULT_USER_ALLOWED_IPS is passed with auto-login off too" {
  write_env_file
  run "$KERGHAN" up --no-auto-login
  [ "$status" -eq 0 ]
  vault_calls | grep -qF -- "-e KERGHAN_DEFAULT_USER_ALLOWED_IPS=$ALLOWED_IPS --runtime"
}

@test "a pre-#371 kerghan.env turns the default auto-login off, on 0.0.0.0, with a notice" {
  write_legacy_env_file
  run "$KERGHAN" up
  [ "$status" -eq 0 ]
  [ "$(vault_calls)" = "$(up_line 0.0.0.0 false)" ]
  assert_output_contains "Automatic login is off: $ENV_FILE has no default user"
  assert_output_contains "To turn it on, run 'kerghan update-env', then 'kerghan up' again."
  [[ "$output" != *warning* ]]
  # kerghan.env is left as it is.
  [ "$(grep -c '^KERGHAN_DEFAULT_USER_' "$ENV_FILE")" -eq 0 ]
}

@test "a pre-#371 kerghan.env still honours bind= from the file" {
  write_legacy_env_file
  write_config "bind=127.0.0.1"
  run "$KERGHAN" up
  [ "$status" -eq 0 ]
  [ "$(vault_calls)" = "$(up_line 127.0.0.1 false)" ]
}

@test "a kerghan.env missing only the password counts as having no default user" {
  write_legacy_env_file "KERGHAN_DEFAULT_USER_USERNAME=admin" \
    "KERGHAN_DEFAULT_USER_EMAIL=admin@kerghan.local" "KERGHAN_DEFAULT_USER_PASSWORD= "
  run "$KERGHAN" up
  [ "$status" -eq 0 ]
  [ "$(vault_calls)" = "$(up_line 0.0.0.0 false)" ]
  assert_output_contains "Automatic login is off"
}

@test "a pre-#371 kerghan.env with --auto-login fails without starting" {
  write_legacy_env_file
  run "$KERGHAN" up --auto-login
  [ "$status" -eq 1 ]
  assert_output_contains "kerghan: error: automatic login needs the default user, but $ENV_FILE has no KERGHAN_DEFAULT_USER_USERNAME"
  assert_output_contains "kerghan: hint: run 'kerghan update-env' to add the default user to kerghan.env"
  [ -z "$(vault_calls)" ]
}

@test "a pre-#371 kerghan.env with auto-login=true in the file fails without starting" {
  write_legacy_env_file
  write_config "auto-login=true"
  export STUB_RUNNING_IMAGE="$IMAGE" STUB_RUNNING_HOST_IP="" STUB_RUNNING_ENV=""
  run "$KERGHAN" up
  [ "$status" -eq 1 ]
  assert_output_contains "kerghan: error: automatic login needs the default user"
  [ -z "$(vault_calls)" ]
}

@test "a pre-#371 kerghan.env with --no-auto-login starts without the notice" {
  write_legacy_env_file
  run "$KERGHAN" up --no-auto-login
  [ "$status" -eq 0 ]
  [ "$(vault_calls)" = "$(up_line 0.0.0.0 false)" ]
  [[ "$output" != *"Automatic login is off"* ]]
}
