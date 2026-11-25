#!/usr/bin/env bats
# KERGHAN_COOKIE_SECURE: the value the client passes, the recreate on a
# change, and the refusal of a kerghan.env that sets it.

load helpers/setup

# cookie_arg - the KERGHAN_COOKIE_SECURE value of the logged vault up.
cookie_arg() {
  vault_calls | grep -o 'KERGHAN_COOKIE_SECURE=[a-z]*' | cut -d= -f2
}

setup_running() {
  write_env_file "$@"
  export STUB_VOLUME_EXISTS=1 STUB_RUNNING_IMAGE="$IMAGE" STUB_RUNNING_PORT=3000 \
    STUB_RUNNING_HOST_IP=127.0.0.1
}

@test "the default loopback bind without FRONTEND_BASE_URL passes false" {
  write_env_file
  run "$KERGHAN" up
  [ "$status" -eq 0 ]
  [ "$(cookie_arg)" = "false" ]
}

@test "another loopback address passes false" {
  write_env_file
  write_config "bind=127.0.0.2"
  run "$KERGHAN" up
  [ "$status" -eq 0 ]
  [ "$(cookie_arg)" = "false" ]
}

@test "an https FRONTEND_BASE_URL on loopback passes true" {
  write_env_file "FRONTEND_BASE_URL=https://kerghan.example.com"
  run "$KERGHAN" up
  [ "$status" -eq 0 ]
  [ "$(cookie_arg)" = "true" ]
}

@test "an http FRONTEND_BASE_URL on loopback passes false" {
  write_env_file "FRONTEND_BASE_URL=http://localhost:9999"
  run "$KERGHAN" up
  [ "$status" -eq 0 ]
  [ "$(cookie_arg)" = "false" ]
}

@test "bind 0.0.0.0 passes loopback" {
  write_env_file
  write_config "bind=0.0.0.0"
  run "$KERGHAN" up
  [ "$status" -eq 0 ]
  [ "$(cookie_arg)" = "loopback" ]
}

@test "a LAN bind passes loopback" {
  write_env_file
  write_config "bind=192.168.1.10"
  run "$KERGHAN" up
  [ "$status" -eq 0 ]
  [ "$(cookie_arg)" = "loopback" ]
}

@test "a non-loopback bind with an https FRONTEND_BASE_URL passes true" {
  write_env_file "FRONTEND_BASE_URL=https://kerghan.example.com"
  write_config "bind=0.0.0.0"
  run "$KERGHAN" up
  [ "$status" -eq 0 ]
  [ "$(cookie_arg)" = "true" ]
}

@test "a running non-loopback instance with KERGHAN_COOKIE_SECURE=true is recreated" {
  setup_running
  write_config "bind=0.0.0.0"
  export STUB_RUNNING_HOST_IP=0.0.0.0
  export STUB_RUNNING_ENV="KERGHAN_DEFAULT_USER_ALWAYS_AUTHENTICATED=true
KERGHAN_COOKIE_SECURE=true"
  run "$KERGHAN" up
  [ "$status" -eq 0 ]
  assert_output_contains "allowing login over plain HTTP on loopback hosts"
  [ "$(cookie_arg)" = "loopback" ]
}

@test "a running non-loopback instance with KERGHAN_COOKIE_SECURE=loopback is not recreated" {
  setup_running
  write_config "bind=0.0.0.0"
  export STUB_RUNNING_HOST_IP=0.0.0.0
  export STUB_RUNNING_ENV="KERGHAN_DEFAULT_USER_ALWAYS_AUTHENTICATED=true
KERGHAN_COOKIE_SECURE=loopback"
  run "$KERGHAN" up
  [ "$status" -eq 0 ]
  assert_output_contains "Kerghan is already running"
  [ -z "$(vault_calls)" ]
}

@test "an instance without KERGHAN_COOKIE_SECURE on loopback is recreated" {
  setup_running
  export STUB_RUNNING_ENV="KERGHAN_DEFAULT_USER_ALWAYS_AUTHENTICATED=true"
  run "$KERGHAN" up
  [ "$status" -eq 0 ]
  assert_output_contains "allowing login over plain HTTP on loopback"
  [ "$(vault_calls | sed -n 1p)" = "vault down --name kerghan --stop-timeout 60" ]
  [ "$(cookie_arg)" = "false" ]
}

@test "a matching KERGHAN_COOKIE_SECURE is not recreated" {
  setup_running
  export STUB_RUNNING_ENV="KERGHAN_DEFAULT_USER_ALWAYS_AUTHENTICATED=true
KERGHAN_COOKIE_SECURE=false"
  run "$KERGHAN" up
  [ "$status" -eq 0 ]
  assert_output_contains "Kerghan is already running"
  [ -z "$(vault_calls)" ]
}

@test "moving to an https FRONTEND_BASE_URL recreates with the reason" {
  setup_running "FRONTEND_BASE_URL=https://kerghan.example.com"
  export STUB_RUNNING_ENV="KERGHAN_DEFAULT_USER_ALWAYS_AUTHENTICATED=true
KERGHAN_COOKIE_SECURE=false"
  run "$KERGHAN" up
  [ "$status" -eq 0 ]
  assert_output_contains "requiring HTTPS for the session cookies"
  [ "$(cookie_arg)" = "true" ]
}

@test "a failed inspect of the environment recreates the instance" {
  setup_running
  export STUB_RUNNING_ENV_FAIL=1
  run "$KERGHAN" up
  [ "$status" -eq 0 ]
  [ "$(vault_calls | sed -n 1p)" = "vault down --name kerghan --stop-timeout 60" ]
}

@test "up refuses a kerghan.env that sets KERGHAN_COOKIE_SECURE" {
  write_env_file "KERGHAN_COOKIE_SECURE=false"
  run "$KERGHAN" up
  [ "$status" -eq 1 ]
  assert_output_contains "sets KERGHAN_COOKIE_SECURE, which the client manages itself"
  assert_output_contains "https FRONTEND_BASE_URL"
}

@test "up refuses a bare KERGHAN_COOKIE_SECURE line" {
  write_env_file "KERGHAN_COOKIE_SECURE"
  run "$KERGHAN" up
  [ "$status" -eq 1 ]
  assert_output_contains "sets KERGHAN_COOKIE_SECURE, which the client manages itself"
}

@test "configure refuses to write KERGHAN_COOKIE_SECURE" {
  write_env_file
  run "$KERGHAN" configure KERGHAN_COOKIE_SECURE=false
  [ "$status" -ne 0 ]
  assert_output_contains "KERGHAN_COOKIE_SECURE is managed by the client"
  ! grep -q KERGHAN_COOKIE_SECURE "$ENV_FILE"
}
