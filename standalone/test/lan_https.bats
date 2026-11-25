#!/usr/bin/env bats
# The plain-HTTP hint of `kerghan up` on non-loopback binds, and the warning
# for automatic login behind a reverse proxy (up and configure); see
# docs/agents/standalone/https.md.

load helpers/setup

DOCS_URL="https://github.com/darthjee/kerghan/blob/main/docs/agents/standalone/https.md"
HINT_ALL="kerghan: hint: other machines cannot log in over plain HTTP; on this host use http://localhost:"
HINT_LAN="kerghan: hint: logging in over plain HTTP fails on 192.168.1.10"
WARN_PROXY="kerghan: warning: automatic login is on and FRONTEND_BASE_URL is https://kerghan.local:8443"

refute_output_contains() {
  case "$output" in
    *"$1"*)
      echo "unexpected output: $1" >&2
      echo "$output" >&2
      return 1
      ;;
  esac
}

# --- the plain-HTTP hint ------------------------------------------------------

@test "bind 0.0.0.0 hints at localhost and the docs" {
  write_env_file
  run "$KERGHAN" up --no-auto-login --bind 0.0.0.0
  [ "$status" -eq 0 ]
  assert_output_contains "${HINT_ALL}3000"
  assert_output_contains "$DOCS_URL"
}

@test "the localhost pointer uses the port" {
  write_env_file
  run "$KERGHAN" up --no-auto-login -p 8080 --bind 0.0.0.0
  [ "$status" -eq 0 ]
  assert_output_contains "${HINT_ALL}8080"
}

@test "a LAN bind hints without a localhost pointer" {
  write_env_file
  run "$KERGHAN" up --no-auto-login --bind 192.168.1.10
  [ "$status" -eq 0 ]
  assert_output_contains "$HINT_LAN"
  refute_output_contains "cannot log in over plain HTTP"
}

@test "the default loopback bind has no hint" {
  write_env_file
  run "$KERGHAN" up
  [ "$status" -eq 0 ]
  refute_output_contains "plain HTTP"
}

@test "another loopback address has no hint" {
  write_env_file
  run "$KERGHAN" up --no-auto-login --bind 127.0.0.2
  [ "$status" -eq 0 ]
  refute_output_contains "plain HTTP"
}

@test "a non-loopback bind with an https FRONTEND_BASE_URL has no hint" {
  write_env_file "FRONTEND_BASE_URL=https://kerghan.example.com"
  run "$KERGHAN" up --no-auto-login --bind 0.0.0.0
  [ "$status" -eq 0 ]
  refute_output_contains "plain HTTP"
}

@test "a non-loopback bind with an http FRONTEND_BASE_URL has the hint" {
  write_env_file "FRONTEND_BASE_URL=http://192.168.1.10:3000"
  run "$KERGHAN" up --no-auto-login --bind 0.0.0.0
  [ "$status" -eq 0 ]
  assert_output_contains "${HINT_ALL}3000"
}

@test "the hint is shown when the instance is already running" {
  write_env_file
  export STUB_VOLUME_EXISTS=1 STUB_RUNNING_IMAGE="$IMAGE" STUB_RUNNING_PORT=3000 \
    STUB_RUNNING_HOST_IP=0.0.0.0
  export STUB_RUNNING_ENV="KERGHAN_DEFAULT_USER_ALWAYS_AUTHENTICATED=false
KERGHAN_COOKIE_SECURE=loopback"
  run "$KERGHAN" up --no-auto-login --bind 0.0.0.0
  [ "$status" -eq 0 ]
  assert_output_contains "Kerghan is already running at"
  assert_output_contains "${HINT_ALL}3000"
}

@test "the auto-login warning comes before the hint, and the hint before the port conflict" {
  write_env_file
  export STUB_LSOF_OUTPUT=$'p1\ncControlCenter\nn*:3000'
  run "$KERGHAN" up --bind 0.0.0.0
  [ "$status" -eq 0 ]
  local auto hint conflict
  auto="$(echo "$output" | grep -n "automatic login is on and the port is published" | head -n 1 | cut -d: -f1)"
  hint="$(echo "$output" | grep -n "cannot log in over plain HTTP" | head -n 1 | cut -d: -f1)"
  conflict="$(echo "$output" | grep -n "already in use" | head -n 1 | cut -d: -f1)"
  [ -n "$auto" ] && [ -n "$hint" ] && [ -n "$conflict" ]
  [ "$auto" -lt "$hint" ]
  [ "$hint" -lt "$conflict" ]
}

# --- automatic login behind a proxy -------------------------------------------

@test "up with auto-login, loopback and an https URL warns and still starts" {
  write_env_file "FRONTEND_BASE_URL=https://kerghan.local:8443"
  run "$KERGHAN" up
  [ "$status" -eq 0 ]
  assert_output_contains "$WARN_PROXY"
  assert_output_contains "set auto-login=false in ~/.kerghan/config"
  [ -n "$(vault_calls | grep ' up ')" ]
}

@test "no proxy warning with auto-login off" {
  write_env_file "FRONTEND_BASE_URL=https://kerghan.local:8443"
  run "$KERGHAN" up --no-auto-login
  [ "$status" -eq 0 ]
  refute_output_contains "if a reverse proxy publishes"
}

@test "no proxy warning when auto-login falls back to off" {
  write_legacy_env_file "FRONTEND_BASE_URL=https://kerghan.local:8443"
  run "$KERGHAN" up
  [ "$status" -eq 0 ]
  refute_output_contains "if a reverse proxy publishes"
}

@test "no proxy warning with an http URL" {
  write_env_file "FRONTEND_BASE_URL=http://localhost:9999"
  run "$KERGHAN" up
  [ "$status" -eq 0 ]
  refute_output_contains "if a reverse proxy publishes"
}

@test "no proxy warning on a non-loopback bind" {
  write_env_file "FRONTEND_BASE_URL=https://kerghan.local:8443"
  run "$KERGHAN" up --bind 0.0.0.0
  [ "$status" -eq 0 ]
  refute_output_contains "if a reverse proxy publishes"
  assert_output_contains "the port is published on 0.0.0.0"
}

@test "configure auto-login=true with an https URL warns" {
  write_env_file "FRONTEND_BASE_URL=https://kerghan.local:8443"
  run "$KERGHAN" configure auto-login=true
  [ "$status" -eq 0 ]
  assert_output_contains "$WARN_PROXY"
  refute_output_contains "plain HTTP"
}

@test "configure FRONTEND_BASE_URL=https with auto-login on warns" {
  write_env_file
  write_config "auto-login=true"
  run "$KERGHAN" configure FRONTEND_BASE_URL=https://kerghan.local:8443
  [ "$status" -eq 0 ]
  assert_output_contains "$WARN_PROXY"
}

@test "configure with an http URL does not warn" {
  write_env_file "FRONTEND_BASE_URL=http://localhost:9999"
  run "$KERGHAN" configure auto-login=true
  [ "$status" -eq 0 ]
  refute_output_contains "if a reverse proxy publishes"
}
