#!/usr/bin/env bats
# kerghan up warns (stderr, never fatal) when another process listens on the
# port on this host; see warn_port_conflict.

load helpers/setup

AIRPLAY=$'p1\ncControlCenter\nn*:5000\nn[::]:5000'
HINT_P="kerghan: hint: use 'kerghan up -p <port>' or set port= in ~/.kerghan/config to pick another port"
HINT_AIRPLAY="kerghan: hint: on macOS this is the AirPlay Receiver; turn it off in System Settings > General > AirDrop & Handoff, or pick another port"
HINT_DIAGNOSE="kerghan: hint: run 'kerghan diagnose' for details"

@test "ControlCenter on 5000: both warnings, the -p hint, the AirPlay hint, and up still starts" {
  write_env_file
  export STUB_LSOF_OUTPUT="$AIRPLAY"
  run "$KERGHAN" up -p 5000
  [ "$status" -eq 0 ]
  assert_output_contains "kerghan: warning: port 5000 is already in use by ControlCenter (*:5000, [::]:5000)"
  assert_output_contains "kerghan: warning: Kerghan is published on 127.0.0.1:5000 only; other addresses (such as localhost:5000) may reach that process instead"
  assert_output_contains "$HINT_P"
  assert_output_contains "$HINT_AIRPLAY"
  [ -n "$(vault_calls | grep ' up ')" ]
}

@test "the same listener on port 3000 has no AirPlay hint" {
  write_env_file
  export STUB_LSOF_OUTPUT=$'p1\ncControlCenter\nn*:3000'
  run "$KERGHAN" up
  [ "$status" -eq 0 ]
  assert_output_contains "port 3000 is already in use by ControlCenter"
  assert_output_contains "$HINT_P"
  refute_output_contains "AirPlay"
}

@test "an unknown process is called another process" {
  write_env_file
  hide_lsof
  export STUB_SS_OUTPUT='LISTEN 0 4096 *:3000 *:*'
  run "$KERGHAN" up
  [ "$status" -eq 0 ]
  assert_output_contains "port 3000 is already in use by another process (*:3000)"
}

@test "no listener: no warning" {
  write_env_file
  run "$KERGHAN" up
  [ "$status" -eq 0 ]
  refute_output_contains "already in use"
}

@test "neither tool: no warning and up starts" {
  write_env_file
  hide_listener_tools
  run "$KERGHAN" up
  [ "$status" -eq 0 ]
  refute_output_contains "already in use"
  [ -n "$(vault_calls | grep ' up ')" ]
}

@test "a remote DOCKER_HOST skips the check" {
  write_env_file
  export STUB_LSOF_OUTPUT="$AIRPLAY"
  DOCKER_HOST=tcp://remote:2376 run "$KERGHAN" up -p 5000
  [ "$status" -eq 0 ]
  refute_output_contains "already in use"
  refute_logged_prefix "lsof"
  refute_logged_prefix "ss"
}

@test "an ssh DOCKER_HOST skips the check" {
  write_env_file
  export STUB_LSOF_OUTPUT="$AIRPLAY"
  DOCKER_HOST=ssh://user@remote run "$KERGHAN" up -p 5000
  refute_output_contains "already in use"
  refute_logged_prefix "lsof"
}

@test "a unix DOCKER_HOST runs the check" {
  write_env_file
  export STUB_LSOF_OUTPUT="$AIRPLAY"
  DOCKER_HOST=unix:///var/run/docker.sock run "$KERGHAN" up -p 5000
  assert_output_contains "already in use by ControlCenter"
}

@test "already running with the same settings: no listener lookup" {
  write_env_file
  export STUB_RUNNING_IMAGE="$IMAGE"
  export STUB_LSOF_OUTPUT="$AIRPLAY"
  run "$KERGHAN" up
  [ "$status" -eq 0 ]
  refute_logged_prefix "lsof"
  refute_logged_prefix "ss"
}

@test "a recreate checks before the new vault up" {
  write_env_file
  export STUB_RUNNING_IMAGE="$IMAGE"
  export STUB_RUNNING_PORT=3000
  export STUB_LSOF_OUTPUT="$AIRPLAY"
  run "$KERGHAN" up -p 5000
  [ "$status" -eq 0 ]
  assert_output_contains "already in use by ControlCenter"
  local lsof_line up_line
  lsof_line="$(grep -n '^lsof' "$STUB_LOG" | head -1 | cut -d: -f1)"
  up_line="$(grep -n '^vault up' "$STUB_LOG" | head -1 | cut -d: -f1)"
  [ "$lsof_line" -lt "$up_line" ]
}

@test "-f also checks" {
  write_env_file
  export STUB_LSOF_OUTPUT="$AIRPLAY"
  run "$KERGHAN" up -f -p 5000
  assert_output_contains "already in use by ControlCenter"
}

@test "--bind 0.0.0.0 shows that address in the second line" {
  write_env_file
  export STUB_LSOF_OUTPUT="$AIRPLAY"
  run "$KERGHAN" up --bind 0.0.0.0 --no-auto-login -p 5000
  assert_output_contains "Kerghan is published on 0.0.0.0:5000 only"
}
