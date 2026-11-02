#!/usr/bin/env bats
# Safety of the bash completion script: shell hygiene, no subprocess, no file
# read, no secret leak, the static deny-list and the bash 3.2 guard
# (docs/agents/specs/auto-complete/security.md). Runs on bash 5 and bash 3.2.
#
# The hygiene and safety cases run in a fresh `bash --norc --noprofile`, not in
# the bats shell (bats turns on errexit and defines its own names). The fresh
# shell runs a small driver that uses builtins only, so it also works with an
# empty PATH.

load helpers/setup
load helpers/completion

SENTINEL_SECRET="sentinel-secret-5f3a9c"

# prepare - after helpers/setup's setup (temporary HOME, stubs): the script
# and the driver.
prepare() {
  BASH_BIN="$(command -v bash)"
  SCRIPT="$TEST_ROOT/completion.bash"
  "$KERGHAN" completion bash >"$SCRIPT"
  write_driver
}

# write_driver - the fresh-shell driver. `r N WORD...` completes COMP_WORDS=
# (WORD...) and prints one `N [candidate]` line per reply. With SNAP set, it
# snapshots options, shopt, IFS and the variable and function names to
# $SNAP.<stage>.* before sourcing, after sourcing and after one completion.
write_driver() {
  DRIVER="$TEST_ROOT/driver.bash"
  cat >"$DRIVER" <<'DRIVER'
COMPREPLY=()
COMP_WORDS=()
COMP_CWORD=0
COMP_LINE=""
COMP_POINT=0
r() {
  local n="$1" w
  shift
  COMP_WORDS=("$@")
  COMP_CWORD=$((${#COMP_WORDS[@]} - 1))
  COMP_LINE="$*"
  COMP_POINT=${#COMP_LINE}
  COMPREPLY=()
  _kerghan kerghan "${COMP_WORDS[COMP_CWORD]}" "${COMP_WORDS[COMP_CWORD - 1]}"
  for w in ${COMPREPLY[@]+"${COMPREPLY[@]}"}; do
    printf '%s [%s]\n' "$n" "$w"
  done
}
snap() {
  if [ -n "${SNAP:-}" ]; then
    {
      set -o
      shopt
      printf 'IFS=%q\n' "$IFS"
    } >"$SNAP.$1.options"
    compgen -v >"$SNAP.$1.vars"
    declare -F >"$SNAP.$1.functions"
  fi
}
if [ -n "${STRICT:-}" ]; then
  set -u
fi
snap before
. "$SCRIPT"
snap sourced
r 1 kerghan ''
snap completed
r 2 kerghan up -
r 3 kerghan configure var
r 4 kerghan configure variant =
if [ -n "${EXTRA:-}" ]; then
  r 5 kerghan configure ''
  r 6 kerghan configure --unset ''
fi
DRIVER
}

# fresh [VAR=VALUE...] - runs the driver in a fresh bash with the given
# environment; stdout in OUT, stderr in ERR, the exit code in status.
fresh() {
  status=0
  env SCRIPT="$SCRIPT" "$@" "$BASH_BIN" --norc --noprofile "$DRIVER" \
    >"$TEST_ROOT/fresh.out" 2>"$TEST_ROOT/fresh.err" || status=$?
  OUT="$(LC_ALL=C sort "$TEST_ROOT/fresh.out")"
  ERR="$(cat "$TEST_ROOT/fresh.err")"
}

# expected_replies - the representative completions' replies, in fresh's
# sorted `N [candidate]` form.
expected_replies() {
  {
    printf '1 [%s]\n' "${ALL_COMMANDS[@]}"
    printf '2 [%s]\n' "${UP_FLAGS[@]}"
    printf '3 [%s]\n' "variant="
    printf '4 [%s]\n' "online " "offline "
  } | LC_ALL=C sort
}

# assert_representative - OUT holds the expected replies and ERR is empty.
assert_representative() {
  local expected
  expected="$(expected_replies)"
  if [ "$OUT" != "$expected" ]; then
    echo "--- expected ---" >&2
    echo "$expected" >&2
    echo "--- actual ---" >&2
    echo "$OUT" >&2
    return 1
  fi
  if [ -n "$ERR" ]; then
    echo "--- unexpected stderr ---" >&2
    echo "$ERR" >&2
    return 1
  fi
}

# write_sentinel_home DIR - a HOME whose config and kerghan.env hold sentinel
# keys and a sentinel secret.
write_sentinel_home() {
  mkdir -p "$1/.kerghan"
  printf 'sentinel-key=%s\nport=4242\n' "$SENTINEL_SECRET" >"$1/.kerghan/config"
  printf 'SENTINEL_KEY=%s\nKERGHAN_SECRET_KEY=%s\n' "$SENTINEL_SECRET" "$SENTINEL_SECRET" \
    >"$1/.kerghan/kerghan.env"
}

@test "hygiene: options: sourcing and completing change no option, shopt or IFS" {
  prepare
  fresh SNAP="$TEST_ROOT/snap"
  [ "$status" -eq 0 ]
  diff "$TEST_ROOT/snap.before.options" "$TEST_ROOT/snap.sourced.options"
  diff "$TEST_ROOT/snap.before.options" "$TEST_ROOT/snap.completed.options"
}

@test "hygiene: names: only _kerghan functions are added and no variable" {
  prepare
  fresh SNAP="$TEST_ROOT/snap"
  [ "$status" -eq 0 ]
  diff "$TEST_ROOT/snap.before.vars" "$TEST_ROOT/snap.completed.vars"
  local line name
  while IFS= read -r line; do
    name="${line##* }"
    if ! grep -qxF -- "$line" "$TEST_ROOT/snap.before.functions"; then
      case "$name" in
        _kerghan | _kerghan_*) ;;
        *)
          echo "unexpected new function: $name" >&2
          return 1
          ;;
      esac
    fi
  done <"$TEST_ROOT/snap.completed.functions"
  grep -qxF "declare -f _kerghan" "$TEST_ROOT/snap.completed.functions"
}

@test "hygiene: set -u: the representative completions work under set -u" {
  prepare
  fresh STRICT=1
  [ "$status" -eq 0 ]
  assert_representative
}

@test "no subprocess: empty PATH: completion needs no external command" {
  prepare
  mkdir -p "$TEST_ROOT/empty-bin" "$TEST_ROOT/empty-home"
  fresh PATH="$TEST_ROOT/empty-bin" HOME="$TEST_ROOT/empty-home"
  [ "$status" -eq 0 ]
  assert_representative
}

@test "no subprocess: command_not_found_handle: no command is looked up" {
  prepare
  if [ "${BASH_VERSINFO[0]}" -lt 4 ]; then
    skip "command_not_found_handle needs bash 4+"
  fi
  mkdir -p "$TEST_ROOT/empty-bin" "$TEST_ROOT/empty-home"
  : >"$TEST_ROOT/cnf.log"
  {
    printf 'command_not_found_handle() { printf "%%s\\n" "$1" >>"%s"; return 127; }\n' \
      "$TEST_ROOT/cnf.log"
    cat "$DRIVER"
  } >"$TEST_ROOT/driver-cnf.bash"
  DRIVER="$TEST_ROOT/driver-cnf.bash"
  fresh PATH="$TEST_ROOT/empty-bin" HOME="$TEST_ROOT/empty-home"
  [ "$status" -eq 0 ]
  assert_representative
  [ ! -s "$TEST_ROOT/cnf.log" ]
}

@test "no file read: sentinel config: replies ignore ~/.kerghan" {
  prepare
  mkdir -p "$TEST_ROOT/empty-home"
  write_sentinel_home "$TEST_ROOT/sentinel-home"
  fresh HOME="$TEST_ROOT/empty-home" EXTRA=1
  [ "$status" -eq 0 ]
  local empty="$OUT"
  [ -n "$empty" ]
  fresh HOME="$TEST_ROOT/sentinel-home" EXTRA=1
  [ "$status" -eq 0 ]
  [ -z "$ERR" ]
  [ "$OUT" = "$empty" ]
  case "$OUT" in
    *SENTINEL* | *sentinel*)
      echo "$OUT" >&2
      return 1
      ;;
  esac
}

@test "no secret leak: generator: the sentinel value is not in the script" {
  write_sentinel_home "$TEST_ROOT/sentinel-home"
  HOME="$TEST_ROOT/sentinel-home" run "$KERGHAN" completion bash
  [ "$status" -eq 0 ]
  refute_output_contains "$SENTINEL_SECRET"
  refute_output_contains "SENTINEL"
  refute_output_contains "sentinel-key"
}

@test "static deny-list: the script holds no subprocess, redirection, file read or home path" {
  prepare
  # Comment lines are stripped; no exception is allowed today.
  grep -v '^[[:space:]]*#' "$SCRIPT" >"$TEST_ROOT/code"
  local token found=false
  for token in '$(' '`' '|' '<' '>' '$HOME' '~' '.kerghan'; do
    if grep -nF -- "$token" "$TEST_ROOT/code" >&2; then
      echo "denied token: $token" >&2
      found=true
    fi
  done
  # source, eval, read and exec as words, not as parts of a longer name.
  if grep -nE '(^|[^A-Za-z0-9_-])(source|eval|read|exec)([^A-Za-z0-9_-]|$)' "$TEST_ROOT/code" >&2; then
    echo "denied word: source, eval, read or exec" >&2
    found=true
  fi
  # `.` as a command: at the start of a command, followed by a space.
  if grep -nE '(^|[;&({])[[:space:]]*\.[[:space:]]' "$TEST_ROOT/code" >&2; then
    echo "denied command: ." >&2
    found=true
  fi
  if grep -nE '(^|[[:space:]])(then|do|else)[[:space:]]+\.[[:space:]]' "$TEST_ROOT/code" >&2; then
    echo "denied command: ." >&2
    found=true
  fi
  [ "$found" = "false" ]
}

@test "bash 3.2 guard: the bash 3.2 run really runs bash 3" {
  if [ "${KERGHAN_TEST_BASH32:-}" != "1" ]; then
    skip "only in the bash 3.2 run (KERGHAN_TEST_BASH32=1)"
  fi
  [ "${BASH_VERSINFO[0]}" -eq 3 ]
}
