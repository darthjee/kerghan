#!/usr/bin/env bats
# bind: precedence (flag > ~/.kerghan/config > default derived from
# auto-login), validation and the unsafe-combination warning.

load helpers/setup

WARNING="kerghan: warning: automatic login is on and the port is published on"

# up_line <bind> <auto-login> [port] - the expected `vault up` line.
up_line() {
  local port="${3:-3000}"
  echo "vault up --name kerghan --image $IMAGE --env-file $ENV_FILE -p $1:$port:80 -e FRONTEND_BASE_URL=http://localhost:$port $(default_user_args "$2") --runtime auto --stop-timeout 60"
}

@test "bind= from the file is used" {
  write_env_file
  write_config "bind=127.0.0.2"
  run "$KERGHAN" up
  [ "$status" -eq 0 ]
  [ "$(vault_calls)" = "$(up_line 127.0.0.2 true)" ]
  [[ "$output" != *warning* ]]
}

@test "--bind wins over bind= from the file" {
  write_env_file
  write_config "bind=0.0.0.0" "auto-login=false"
  run "$KERGHAN" up --bind 127.0.0.1
  [ "$status" -eq 0 ]
  [ "$(vault_calls)" = "$(up_line 127.0.0.1 false)" ]
}

@test "an explicit bind wins over the auto-login-off default" {
  write_env_file
  run "$KERGHAN" up --no-auto-login --bind 192.168.1.10 -p 8080
  [ "$status" -eq 0 ]
  [ "$(vault_calls)" = "$(up_line 192.168.1.10 false 8080)" ]
  [[ "$output" != *warning* ]]
}

@test "an empty bind= uses the default derived from auto-login" {
  write_env_file
  write_config "bind=" "auto-login=false"
  run "$KERGHAN" up
  [ "$status" -eq 0 ]
  [ "$(vault_calls)" = "$(up_line 0.0.0.0 false)" ]
}

@test "auto-login with bind=0.0.0.0 warns but still starts" {
  write_env_file
  write_config "bind=0.0.0.0"
  run "$KERGHAN" up
  [ "$status" -eq 0 ]
  assert_output_contains "$WARNING 0.0.0.0: anyone who can reach it is logged in as admin"
  assert_output_contains "kerghan: hint: use 'kerghan up --no-auto-login' or set bind=127.0.0.1"
  [ "$(vault_calls)" = "$(up_line 0.0.0.0 true)" ]
  assert_output_contains "Kerghan is running at http://localhost:3000"
}

@test "auto-login with --bind on a LAN address warns" {
  write_env_file
  run "$KERGHAN" up --bind 192.168.1.10
  [ "$status" -eq 0 ]
  assert_output_contains "$WARNING 192.168.1.10"
}

@test "no warning with auto-login off on 0.0.0.0" {
  write_env_file
  run "$KERGHAN" up --no-auto-login --bind 0.0.0.0
  [ "$status" -eq 0 ]
  [[ "$output" != *warning* ]]
}

@test "an invalid bind= fails with the line number, before any side effect" {
  write_config "port=8080" "bind=localhost"
  run "$KERGHAN" up
  [ "$status" -eq 1 ]
  assert_output_contains "kerghan: error: $CONFIG_FILE:2: invalid bind 'localhost' (expected an IPv4 address)"
  [ -z "$(vault_calls)" ]
  refute_logged_prefix "openssl"
  [ ! -e "$ENV_FILE" ]
}

@test "bind= rejects out-of-range and malformed addresses" {
  local value
  for value in 256.0.0.1 1.2.3 1.2.3.4.5 1..2.3 ::1 1.2.3.4a 1234.1.1.1; do
    write_config "bind=$value"
    run "$KERGHAN" up
    [ "$status" -eq 1 ]
    assert_output_contains "invalid bind '$value'"
  done
}

@test "an invalid --bind is a usage error" {
  run "$KERGHAN" up --bind 300.1.1.1
  [ "$status" -eq 2 ]
  assert_output_contains "kerghan: error: invalid bind address '300.1.1.1' (expected an IPv4 address)"
  assert_output_contains "Usage: kerghan"
  [ -z "$(vault_calls)" ]
}

@test "--bind without a value is a usage error" {
  run "$KERGHAN" up --bind
  [ "$status" -eq 2 ]
  assert_output_contains "kerghan: error: option '--bind' requires a value"
}
