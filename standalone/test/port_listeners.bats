#!/usr/bin/env bats
# port_listeners <port>: the processes listening on a TCP port (lsof, else ss;
# status 2 when neither exists).

load helpers/setup

# listeners <port> - runs port_listeners from the sourced client in a subshell.
listeners() {
  run bash -c 'source "$1"; port_listeners "$2"' _ "$KERGHAN" "$1"
}

@test "lsof: ControlCenter on *:5000 over IPv4 and IPv6" {
  export STUB_LSOF_OUTPUT=$'p123\ncControlCenter\nn*:5000\nn*:5000\np123\ncControlCenter\nn[::1]:5000'
  listeners 5000
  [ "$status" -eq 0 ]
  [ "$(printf '%s\n' "$output" | wc -l | tr -d ' ')" = "2" ]
  assert_output_contains $'*:5000\tControlCenter'
  assert_output_contains $'[::1]:5000\tControlCenter'
  assert_logged "lsof +c 0 -nP -iTCP:5000 -sTCP:LISTEN -F cn"
}

@test "lsof: no match (exit 1) is no listener" {
  listeners 5000
  [ "$status" -eq 0 ]
  [ -z "$output" ]
}

@test "ss fallback with a users column" {
  hide_lsof
  export STUB_SS_OUTPUT='LISTEN 0 4096 127.0.0.1:5000 0.0.0.0:* users:(("nginx",pid=7,fd=6))'
  listeners 5000
  [ "$status" -eq 0 ]
  [ "$output" = $'127.0.0.1:5000\tnginx' ]
  assert_logged 'ss -Hltnp sport = :5000'
}

@test "ss fallback without a users column" {
  hide_lsof
  export STUB_SS_OUTPUT='LISTEN 0 4096 *:5000 *:*'
  listeners 5000
  [ "$status" -eq 0 ]
  [ "$output" = $'*:5000\t' ]
}

@test "neither lsof nor ss: skipped with status 2" {
  hide_listener_tools
  run bash -c 'source "$1"; port_listeners 5000' _ "$KERGHAN"
  [ "$status" -eq 2 ]
  [ -z "$output" ]
}
