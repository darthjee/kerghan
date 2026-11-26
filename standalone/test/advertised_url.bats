#!/usr/bin/env bats
# The URL `kerghan up` prints, per bind: the published address (127.0.0.1 for
# 0.0.0.0), never localhost. See advertised_url.

load helpers/setup

# running_with <host-ip> <auto-login> <cookie-secure> - a running instance
# published on <host-ip>:3000 with the given client-managed environment.
running_with() {
  write_env_file
  export STUB_VOLUME_EXISTS=1 STUB_RUNNING_IMAGE="$IMAGE" STUB_RUNNING_PORT=3000 \
    STUB_RUNNING_HOST_IP="$1"
  export STUB_RUNNING_ENV="KERGHAN_DEFAULT_USER_ALWAYS_AUTHENTICATED=$2
KERGHAN_COOKIE_SECURE=$3"
}

# assert_running_at <url> - up started the instance and printed exactly <url>.
assert_running_at() {
  [ "$status" -eq 0 ]
  echo "$output" | grep -qxF "Kerghan is running at $1"
  refute_output_contains "localhost"
}

# assert_already_running_at <url> - a no-op up printed exactly <url>.
assert_already_running_at() {
  [ "$status" -eq 0 ]
  echo "$output" | grep -qxF "Kerghan is already running at $1"
  [ -z "$(vault_calls)" ]
  refute_output_contains "localhost"
}

# --- started ------------------------------------------------------------------

@test "the default bind prints http://127.0.0.1:<port>" {
  write_env_file
  run "$KERGHAN" up
  assert_running_at "http://127.0.0.1:3000"
}

@test "the default bind prints the custom port" {
  write_env_file
  run "$KERGHAN" up -p 8080
  assert_running_at "http://127.0.0.1:8080"
}

@test "another loopback bind is printed as it is" {
  write_env_file
  run "$KERGHAN" up --bind 127.0.0.2
  assert_running_at "http://127.0.0.2:3000"
}

@test "bind 0.0.0.0 prints http://127.0.0.1:<port>" {
  write_env_file
  run "$KERGHAN" up --bind 0.0.0.0 -p 8080
  assert_running_at "http://127.0.0.1:8080"
}

@test "a LAN bind prints that address, with the plain-HTTP hint" {
  write_env_file
  run "$KERGHAN" up --bind 192.168.1.5
  assert_running_at "http://192.168.1.5:3000"
  assert_output_contains "kerghan: hint: logging in over plain HTTP fails on 192.168.1.5"
}

# --- already running ----------------------------------------------------------

@test "already running on the default bind prints http://127.0.0.1:<port>" {
  running_with 127.0.0.1 true false
  run "$KERGHAN" up
  assert_already_running_at "http://127.0.0.1:3000"
}

@test "already running on another loopback bind prints it" {
  running_with 127.0.0.2 true false
  run "$KERGHAN" up --bind 127.0.0.2
  assert_already_running_at "http://127.0.0.2:3000"
}

@test "already running on 0.0.0.0 prints http://127.0.0.1:<port>" {
  running_with 0.0.0.0 true loopback
  run "$KERGHAN" up --bind 0.0.0.0
  assert_already_running_at "http://127.0.0.1:3000"
}

@test "already running on a LAN bind prints that address" {
  running_with 192.168.1.5 true loopback
  run "$KERGHAN" up --bind 192.168.1.5
  assert_already_running_at "http://192.168.1.5:3000"
}

# --- help ---------------------------------------------------------------------

@test "the help text names the default bind's URL" {
  run "$KERGHAN" help
  [ "$status" -eq 0 ]
  assert_output_contains "start Kerghan (detached by default) on http://127.0.0.1:3000"
  refute_output_contains "localhost"
}
