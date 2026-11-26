#!/usr/bin/env bats
# kerghan diagnose: a read-only end-to-end check with a verdict and exit codes
# (0 ok, 1 not running, 2 usage, 3 engine, 4 unhealthy, 5 published address,
# 6 advertised URL). See cmd_diagnose.

load helpers/setup

AIRPLAY=$'p1\ncControlCenter\nn*:5000\nn[::]:5000'

setup() {
  TEST_ROOT="$(mktemp -d "$BATS_TMPDIR/kerghan-test.XXXXXX")"
  export HOME="$TEST_ROOT/home"
  STUB_BIN="$TEST_ROOT/bin"
  mkdir -p "$HOME/.kerghan" "$STUB_BIN"
  cp "$BATS_TEST_DIRNAME/stubs/vault" "$BATS_TEST_DIRNAME/stubs/docker" \
    "$BATS_TEST_DIRNAME/stubs/openssl" "$BATS_TEST_DIRNAME/stubs/lsof" \
    "$BATS_TEST_DIRNAME/stubs/ss" "$BATS_TEST_DIRNAME/stubs/mktemp" \
    "$BATS_TEST_DIRNAME/stubs/curl" "$STUB_BIN/"
  chmod +x "$STUB_BIN"/*
  export SYSTEM_PATH="$PATH"
  export PATH="$STUB_BIN:$PATH"
  export STUB_LOG="$TEST_ROOT/stub.log"
  : >"$STUB_LOG"
  ENV_FILE="$HOME/.kerghan/kerghan.env"
  CONFIG_FILE="$HOME/.kerghan/config"
  unset DOCKER_HOST STUB_RUNNING_STATE STUB_RUNNING_PORT STUB_RUNNING_HOST_IP \
    STUB_RUNNING_ENV STUB_DOCKER_INFO_EXIT STUB_LSOF_OUTPUT STUB_SS_OUTPUT \
    STUB_COMPOSE_PS STUB_RUNNING_EXIT_CODE STUB_FILE_LOGS STUB_LOG_MOUNT
  export STUB_RUNNING_IMAGE="$IMAGE"
}

# hide_curl - curl cannot be found (neither the stub nor a real one).
hide_curl() {
  rm -f "$STUB_BIN/curl"
  hide_real_listener_tools
}

# refute_logged_substring <text> - no STUB_LOG line contains <text>.
refute_logged_substring() {
  if grep -qF -- "$1" "$STUB_LOG"; then
    echo "unexpected stub call containing: $1" >&2
    cat "$STUB_LOG" >&2
    return 1
  fi
}

@test "healthy instance: OK, exit 0, both probes" {
  run "$KERGHAN" diagnose
  [ "$status" -eq 0 ]
  assert_output_contains "kerghan diagnose (client $CURRENT_VERSION)"
  assert_output_contains "[ok]   vault-kerghan is running ($IMAGE)"
  assert_output_contains "published on 127.0.0.1:3000, auto-login on"
  assert_output_contains "[ok]   tent     running"
  assert_output_contains "[ok]   mysql    healthy"
  assert_output_contains "[ok]   http://127.0.0.1:3000/health.json   Kerghan (Server: Apache/2.4.68 (Debian))"
  assert_output_contains "[ok]   http://127.0.0.1:3000/ready.json   ready"
  assert_output_contains "[ok]   http://localhost:3000/health.json"
  assert_output_contains "Verdict: OK"
}

@test "advertised URL equal to the published one: a single health probe" {
  export STUB_RUNNING_HOST_IP=localhost
  run "$KERGHAN" diagnose
  [ "$status" -eq 0 ]
  [ "$(grep -c 'health.json' "$STUB_LOG")" -eq 1 ]
  assert_output_contains "Verdict: OK"
}

@test "advertised URL answered by AirTunes: exit 6, AirPlay named, reachable-at hint" {
  export STUB_RUNNING_PORT=5000
  write_config "port=5000"
  export STUB_PROBE_LOCALHOST_HEALTH='403||AirTunes/935.7.1'
  export STUB_LSOF_OUTPUT="$AIRPLAY"
  run "$KERGHAN" diagnose
  [ "$status" -eq 6 ]
  assert_output_contains "[FAIL] http://localhost:5000/health.json   403 from another service (Server: AirTunes/935.7.1)"
  assert_output_contains "[warn]"
  assert_output_contains "ControlCenter"
  assert_output_contains "Verdict: localhost:5000 is answered by another process (AirPlay Receiver);"
  assert_output_contains "Kerghan is reachable at http://127.0.0.1:5000"
  assert_output_contains "hint: on macOS this is the AirPlay Receiver"
}

@test "advertised URL answered by another service without AirPlay: Server named, no AirPlay hint" {
  export STUB_PROBE_LOCALHOST_HEALTH='404|nope|nginx'
  run "$KERGHAN" diagnose
  [ "$status" -eq 6 ]
  assert_output_contains "Verdict: localhost:3000 is answered by another process (nginx);"
  assert_output_contains "Kerghan is reachable at http://127.0.0.1:3000"
  refute_output_contains "AirPlay"
}

@test "advertised URL timing out: exit 6" {
  export STUB_PROBE_LOCALHOST_HEALTH=timeout
  run "$KERGHAN" diagnose
  [ "$status" -eq 6 ]
  assert_output_contains "Verdict: localhost:3000 does not answer;"
  assert_output_contains "Kerghan is reachable at http://127.0.0.1:3000"
}

@test "advertised URL refusing: exit 6" {
  export STUB_PROBE_LOCALHOST_HEALTH=refused
  run "$KERGHAN" diagnose
  [ "$status" -eq 6 ]
  assert_output_contains "connection refused"
  assert_output_contains "Verdict: localhost:3000 does not answer;"
}

@test "published address answered by another service: exit 5, no second probe" {
  export STUB_PROBE_127_0_0_1_HEALTH='403||AirTunes/935.7.1'
  run "$KERGHAN" diagnose
  [ "$status" -eq 5 ]
  assert_output_contains "Verdict: 127.0.0.1:3000 is answered by another process (AirTunes/935.7.1)"
  refute_logged_substring "localhost:3000"
  refute_logged_substring "ready.json"
}

@test "published address timing out: exit 5" {
  export STUB_PROBE_127_0_0_1_HEALTH=timeout
  run "$KERGHAN" diagnose
  [ "$status" -eq 5 ]
  assert_output_contains "Verdict: 127.0.0.1:3000 does not answer"
}

@test "a 200 with another body is another service" {
  export STUB_PROBE_127_0_0_1_HEALTH='200|<html>hi</html>|Apache'
  run "$KERGHAN" diagnose
  [ "$status" -eq 5 ]
  assert_output_contains "200 from another service (Server: Apache)"
  refute_output_contains "<html>"
}

@test "/ready.json 503: not ready (database), exit 4" {
  export STUB_PROBE_127_0_0_1_READY='503|{"status":"down"}|Apache'
  run "$KERGHAN" diagnose
  [ "$status" -eq 4 ]
  assert_output_contains "not ready (database)"
  assert_output_contains "Verdict: Kerghan answers but is not ready (database)"
}

@test "/ready.json 404: readiness unknown, not a failure" {
  export STUB_PROBE_127_0_0_1_READY='404||Apache'
  run "$KERGHAN" diagnose
  [ "$status" -eq 0 ]
  assert_output_contains "readiness unknown (404)"
  assert_output_contains "Verdict: OK"
}

@test "E1: no container: exit 1 and nothing else runs" {
  unset STUB_RUNNING_IMAGE
  run "$KERGHAN" diagnose
  [ "$status" -eq 1 ]
  assert_output_contains "vault-kerghan is not running"
  assert_output_contains "Verdict: Kerghan is not running; start it with 'kerghan up'"
  refute_logged_prefix "curl"
  refute_logged_prefix "lsof"
  refute_logged_prefix "vault"
}

@test "E1: stopped container shows its exit code" {
  export STUB_RUNNING_STATE=false STUB_RUNNING_EXIT_CODE=137
  run "$KERGHAN" diagnose
  [ "$status" -eq 1 ]
  assert_output_contains "vault-kerghan is stopped (exit code 137)"
  refute_logged_prefix "curl"
}

@test "E2: unreachable engine: exit 3 and nothing else runs" {
  export STUB_DOCKER_INFO_EXIT=1
  run "$KERGHAN" diagnose
  [ "$status" -eq 3 ]
  assert_output_contains "Verdict: cannot reach the Docker engine"
  refute_logged_prefix "docker inspect"
  refute_logged_prefix "curl"
  refute_logged_prefix "vault"
}

@test "E3: a tcp DOCKER_HOST skips probes and listeners, label without user info" {
  DOCKER_HOST=tcp://user:secret@remote.example:2376 run "$KERGHAN" diagnose
  [ "$status" -eq 0 ]
  assert_output_contains "[skip] remote Docker engine (tcp://remote.example)"
  assert_output_contains "Verdict: OK (partial: probes skipped)"
  refute_output_contains "secret"
  refute_logged_prefix "curl"
  refute_logged_prefix "lsof"
  refute_logged_prefix "ss"
}

@test "E3: an ssh DOCKER_HOST skips probes and listeners" {
  DOCKER_HOST=ssh://me@remote run "$KERGHAN" diagnose
  [ "$status" -eq 0 ]
  assert_output_contains "[skip] remote Docker engine (ssh://remote)"
  refute_logged_prefix "curl"
  refute_logged_prefix "lsof"
}

@test "E4: an empty HostIp probes 127.0.0.1" {
  export STUB_RUNNING_HOST_IP=
  run "$KERGHAN" diagnose
  [ "$status" -eq 0 ]
  assert_output_contains "published on 0.0.0.0:3000"
  assert_output_contains "http://127.0.0.1:3000/health.json"
}

@test "E4: a 0.0.0.0 HostIp probes 127.0.0.1" {
  export STUB_RUNNING_HOST_IP=0.0.0.0
  run "$KERGHAN" diagnose
  [ "$status" -eq 0 ]
  assert_output_contains "http://127.0.0.1:3000/health.json"
}

@test "E5: a LAN bind probes that address" {
  export STUB_RUNNING_HOST_IP=192.168.1.10
  run "$KERGHAN" diagnose
  [ "$status" -eq 0 ]
  assert_output_contains "http://192.168.1.10:3000/health.json"
  refute_output_contains "http://127.0.0.1:3000"
}

@test "E6: FRONTEND_BASE_URL is printed and never probed" {
  write_env_file "FRONTEND_BASE_URL=https://kerghan.example.com"
  run "$KERGHAN" diagnose
  [ "$status" -eq 0 ]
  assert_output_contains "FRONTEND_BASE_URL is https://kerghan.example.com (not probed)"
  refute_logged_substring "kerghan.example.com"
}

@test "E7: a config port that differs gets a note, and the running port is probed" {
  write_config "port=4000"
  run "$KERGHAN" diagnose
  [ "$status" -eq 0 ]
  assert_output_contains "config wants port 4000; applies on the next 'kerghan up'"
  assert_output_contains "http://127.0.0.1:3000/health.json"
}

@test "E8: an unhealthy mysql names the service, exit 4" {
  export STUB_COMPOSE_PS=$'tent running\nkerghan running\nmysql running unhealthy'
  run "$KERGHAN" diagnose
  [ "$status" -eq 4 ]
  assert_output_contains "[FAIL] mysql    unhealthy"
  assert_output_contains "Verdict: mysql is unhealthy; see 'kerghan logs'"
}

@test "E8: an exited kerghan service, exit 4, with the log dir" {
  export STUB_COMPOSE_PS=$'tent running\nkerghan exited\nmysql running healthy'
  run "$KERGHAN" diagnose
  [ "$status" -eq 4 ]
  assert_output_contains "Verdict: kerghan is exited; see 'kerghan logs' or ~/.kerghan/logs"
}

@test "E8: an unparsable compose ps row is unknown, not a failure" {
  export STUB_COMPOSE_PS=$'tent running\ngarbage\nmysql running healthy'
  run "$KERGHAN" diagnose
  [ "$status" -eq 0 ]
  assert_output_contains "[info] kerghan  unknown"
  assert_output_contains "Verdict: OK"
}

@test "E9: Docker listeners are not flagged" {
  export STUB_LSOF_OUTPUT=$'p1\ncdocker-proxy\nn127.0.0.1:3000\np2\ncOrbStack\nn*:3000\np3\nccom.docker.backend\nn[::1]:3000'
  run "$KERGHAN" diagnose
  [ "$status" -eq 0 ]
  refute_output_contains "[warn]"
  assert_output_contains "[info] 127.0.0.1:3000"
}

@test "E9: a foreign listener is flagged, and the verdict stays OK when the probes pass" {
  export STUB_LSOF_OUTPUT=$'p1\ncControlCenter\nn*:3000'
  run "$KERGHAN" diagnose
  [ "$status" -eq 0 ]
  assert_output_contains "[warn]"
  assert_output_contains "ControlCenter"
  assert_output_contains "Verdict: OK"
}

@test "E9: an empty process name is an unknown process, not flagged" {
  hide_lsof
  export STUB_SS_OUTPUT='LISTEN 0 4096 *:3000 *:*'
  run "$KERGHAN" diagnose
  [ "$status" -eq 0 ]
  assert_output_contains "unknown process"
  refute_output_contains "[warn]"
}

@test "E10: no curl: probes skipped, partial OK" {
  hide_curl
  run "$KERGHAN" diagnose
  [ "$status" -eq 0 ]
  assert_output_contains "[skip] curl not found"
  assert_output_contains "Verdict: OK (partial: probes skipped)"
}

@test "E10: no lsof nor ss: listeners skipped, not a failure" {
  hide_listener_tools
  run "$KERGHAN" diagnose
  [ "$status" -eq 0 ]
  assert_output_contains "[skip] neither lsof nor ss is available"
  assert_output_contains "Verdict: OK"
}

@test "E11: no listener visible but the probe works: OK" {
  run "$KERGHAN" diagnose
  [ "$status" -eq 0 ]
  assert_output_contains "[info] no listener visible"
  assert_output_contains "Verdict: OK"
}

@test "logs: file logs on shows the directory as ~/..." {
  run "$KERGHAN" diagnose
  assert_output_contains "Logs"
  assert_output_contains "[info] ~/.kerghan/logs"
  refute_output_contains "$HOME"
}

@test "logs: file logs off prints no Logs section" {
  export STUB_FILE_LOGS=false
  run "$KERGHAN" diagnose
  refute_output_contains "Logs"
}

@test "an argument is a usage error, exit 2" {
  run "$KERGHAN" diagnose foo
  [ "$status" -eq 2 ]
  assert_output_contains "unknown option 'foo'"
  refute_logged_prefix "curl"
}

@test "safety: every probe is hardened" {
  run "$KERGHAN" diagnose
  local line
  while IFS= read -r line; do
    case "$line" in
      "curl "*)
        case "$line" in
          *" -q "*"--max-time 3"*"--noproxy *"*"--connect-timeout 2"* | *" -q "*"--connect-timeout 2"*"--max-time 3"*"--noproxy *"*) ;;
          *)
            echo "unhardened probe: $line" >&2
            return 1
            ;;
        esac
        ;;
    esac
  done <"$STUB_LOG"
  grep -q '^curl ' "$STUB_LOG"
}

@test "safety: secrets in kerghan.env and the container env never appear" {
  write_env_file "SENTINEL_SECRET=sentinel-env-file-value"
  export STUB_RUNNING_ENV=$'KERGHAN_DEFAULT_USER_ALWAYS_AUTHENTICATED=true\nSENTINEL_CONTAINER=sentinel-container-value'
  run "$KERGHAN" diagnose
  [ "$status" -eq 0 ]
  refute_output_contains "sentinel"
  refute_output_contains "existing-password"
  refute_output_contains "existing-secret"
}

@test "safety: control characters in a Server header are stripped" {
  export STUB_PROBE_LOCALHOST_HEALTH="403||Evil"$'\033'"[31mRed"
  run "$KERGHAN" diagnose
  [ "$status" -eq 6 ]
  case "$output" in
    *$'\033'*)
      echo "escape sequence in output" >&2
      return 1
      ;;
  esac
  assert_output_contains "Evil[31mRed"
}

@test "safety: ~/.kerghan is not changed, nor created" {
  rm -rf "$HOME/.kerghan"
  run "$KERGHAN" diagnose
  [ ! -e "$HOME/.kerghan" ]
  mkdir -p "$HOME/.kerghan"
  write_env_file
  write_config "port=3000"
  local before after
  before="$(cd "$HOME/.kerghan" && ls -lA --time-style=+ 2>/dev/null || ls -lA "$HOME/.kerghan")"
  run "$KERGHAN" diagnose
  after="$(cd "$HOME/.kerghan" && ls -lA --time-style=+ 2>/dev/null || ls -lA "$HOME/.kerghan")"
  [ "$before" = "$after" ]
}

@test "a timeout on PATH is used for the engine calls" {
  printf '#!/usr/bin/env bash\necho "timeout $*" >>"$STUB_LOG"\nshift\nexec "$@"\n' >"$STUB_BIN/timeout"
  chmod +x "$STUB_BIN/timeout"
  run "$KERGHAN" diagnose
  [ "$status" -eq 0 ]
  assert_logged "timeout 5 docker info"
}
