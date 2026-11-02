# Completion harness for the completion*.bats files (docs/agents/standalone/
# client-completion.md#testing). Load it after helpers/setup, which
# provides the temporary HOME and the failing stubs.
#
# The tests drive _kerghan directly with explicit COMP_WORDS; they do not
# simulate readline. Must run on bash 3.2: no mapfile, no associative arrays.
# shellcheck disable=SC2034,SC2154 # word sets are used by the .bats files

# --- Word sets (the spec's lists; completion_sync.bats guards them) --------

ALL_COMMANDS=("up " "down " "logs " "status " "compose " "reset " "update " "update-env "
  "configure " "wizard " "version " "completion " "help " "-h " "--help ")
UP_FLAGS=("--offline " "-p " "--port " "--auto-login " "--no-auto-login " "--bind " "-f ")
UPDATE_FLAGS=("--force " "--yes " "--restart " "--no-restart ")
CONFIG_KEYS_EQ=("port=" "variant=" "runtime=" "stop-timeout=" "image-tag=" "auto-login="
  "bind=" "restart-on-update=")
ENV_KEYS_EQ=("KERGHAN_SECRET_KEY=" "KERGHAN_INTEGRATIONS_KEY=" "KERGHAN_DEFAULT_USER_ENABLED="
  "KERGHAN_DEFAULT_USER_USERNAME=" "KERGHAN_DEFAULT_USER_EMAIL="
  "KERGHAN_DEFAULT_USER_PASSWORD=" "KERGHAN_DEFAULT_USER_ADMIN=" "FRONTEND_BASE_URL=")
UNSET_KEYS=("port " "variant " "runtime " "stop-timeout " "image-tag " "auto-login " "bind "
  "restart-on-update " "FRONTEND_BASE_URL ")

# source_completion - writes `kerghan completion bash` to a file and sources it
# into the test shell itself (not through `run`: COMPREPLY is read afterwards).
source_completion() {
  "$KERGHAN" completion bash >"$BATS_TEST_TMPDIR/completion.bash"
  # shellcheck disable=SC1091
  source "$BATS_TEST_TMPDIR/completion.bash"
}

# complete_words LINE -- WORD... - completes with COMP_WORDS=(WORD...), the
# cursor at the end of LINE and COMP_CWORD on the last word. Calls _kerghan with
# the three arguments bash passes (command, current word, previous word).
complete_words() {
  local line="$1"
  shift
  if [ "${1-}" != "--" ]; then
    echo "complete_words: expected -- after LINE" >&2
    return 1
  fi
  shift
  COMP_LINE="$line"
  COMP_POINT="${#line}"
  COMP_WORDS=("$@")
  COMP_CWORD=$((${#COMP_WORDS[@]} - 1))
  local cur="${COMP_WORDS[COMP_CWORD]-}" prev=""
  if [ "$COMP_CWORD" -ge 1 ]; then
    prev="${COMP_WORDS[COMP_CWORD - 1]-}"
  fi
  COMPREPLY=()
  _kerghan "${COMP_WORDS[0]-kerghan}" "$cur" "$prev"
}

# complete_line LINE - complete_words for a line without = or :, split on
# whitespace only; a trailing space gives an empty last word.
complete_line() {
  local line="$1"
  case "$line" in
    *=* | *:*)
      echo "complete_line: '$line' holds = or :; use complete_words" >&2
      return 1
      ;;
  esac
  local words=() word rest="$line"
  while [ -n "$rest" ]; do
    case "$rest" in
      [[:space:]]*)
        rest="${rest#?}"
        ;;
      *)
        word="${rest%%[[:space:]]*}"
        words+=("$word")
        rest="${rest#"$word"}"
        ;;
    esac
  done
  case "$line" in
    '' | *[[:space:]]) words+=("") ;;
  esac
  complete_words "$line" -- "${words[@]}"
}

# _bracketed WORD... - one [word] per line, sorted.
_bracketed() {
  if [ "$#" -gt 0 ]; then
    printf '[%s]\n' "$@" | LC_ALL=C sort
  fi
}

# assert_reply WORD... - COMPREPLY holds exactly WORD... (order-insensitive,
# trailing spaces significant).
assert_reply() {
  local expected actual
  expected="$(_bracketed "$@")"
  actual="$(_bracketed ${COMPREPLY[@]+"${COMPREPLY[@]}"})"
  if [ "$expected" != "$actual" ]; then
    echo "COMPREPLY mismatch for: ${COMP_LINE-}" >&2
    echo "--- expected ---" >&2
    echo "$expected" >&2
    echo "--- actual ---" >&2
    echo "$actual" >&2
    return 1
  fi
}

# assert_no_reply - COMPREPLY is empty.
assert_no_reply() {
  if [ "${#COMPREPLY[@]}" -ne 0 ]; then
    echo "expected no reply for: ${COMP_LINE-}" >&2
    _bracketed "${COMPREPLY[@]}" >&2
    return 1
  fi
}

# minus SET WORD... - sets EXPECTED to the words of the array named SET
# without WORD...
minus() {
  local set="$1" word skip drop
  shift
  EXPECTED=()
  eval "set -- \"\$@\" -- \${$set[@]+\"\${$set[@]}\"}"
  local removed=()
  while [ "$1" != "--" ]; do
    removed+=("$1")
    shift
  done
  shift
  for word in "$@"; do
    skip=false
    for drop in ${removed[@]+"${removed[@]}"}; do
      if [ "$word" = "$drop" ]; then
        skip=true
      fi
    done
    if [ "$skip" = "false" ]; then
      EXPECTED+=("$word")
    fi
  done
}
