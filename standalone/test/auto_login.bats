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

@test "the client-managed -e values come after --env-file even when kerghan.env sets them" {
  write_env_file "KERGHAN_DEFAULT_USER_ALWAYS_AUTHENTICATED=false" \
    "KERGHAN_DEFAULT_USER_ALLOWED_IPS=203.0.113.7"
  run "$KERGHAN" up
  [ "$status" -eq 0 ]
  [ "$(vault_calls)" = "$(up_line 127.0.0.1 true)" ]
  # kerghan.env is left as it is.
  grep -qx 'KERGHAN_DEFAULT_USER_ALWAYS_AUTHENTICATED=false' "$ENV_FILE"
}

@test "KERGHAN_DEFAULT_USER_ALLOWED_IPS is passed with auto-login off too" {
  write_env_file
  run "$KERGHAN" up --no-auto-login
  [ "$status" -eq 0 ]
  vault_calls | grep -qF -- "-e KERGHAN_DEFAULT_USER_ALLOWED_IPS=$ALLOWED_IPS --runtime"
}
