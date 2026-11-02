#!/usr/bin/env bats
# `kerghan completion <shell>`: output, errors, exit codes, the usage line, no
# side effects, fixed text and the stable contracts
# (docs/agents/standalone/client-completion.md: "`kerghan completion <shell>`",
# "Stable contracts", "Performance and security").
# Runs on bash 5 and bash 3.2.

load helpers/setup
load helpers/completion

# run_split ARG... - runs the client with ARG..., stdout and stderr captured
# apart in OUT and ERR (bats' run merges them), the exit code in status.
run_split() {
  status=0
  "$KERGHAN" "$@" >"$BATS_TEST_TMPDIR/out" 2>"$BATS_TEST_TMPDIR/err" || status=$?
  OUT="$(cat "$BATS_TEST_TMPDIR/out")"
  ERR="$(cat "$BATS_TEST_TMPDIR/err")"
}

# assert_usage_error MESSAGE ARG... - `kerghan ARG...` exits 2, prints nothing
# on stdout and `kerghan: error: MESSAGE` then the full usage on stderr.
assert_usage_error() {
  local message="$1" expected
  shift
  run_split "$@"
  expected="$(
    echo "kerghan: error: $message"
    "$KERGHAN" help
  )"
  [ "$status" -eq 2 ]
  [ -z "$OUT" ]
  if [ "$ERR" != "$expected" ]; then
    echo "--- expected stderr ---" >&2
    echo "$expected" >&2
    echo "--- actual stderr ---" >&2
    echo "$ERR" >&2
    return 1
  fi
}

# reply_of WORD... - the sorted, bracketed COMPREPLY for COMP_WORDS=(WORD...).
reply_of() {
  complete_words "$*" -- "$@"
  REPLY_TEXT="$(_bracketed ${COMPREPLY[@]+"${COMPREPLY[@]}"})"
}

@test "contract completion bash: prints the script on stdout only and exits 0" {
  run_split completion bash
  [ "$status" -eq 0 ]
  [ -z "$ERR" ]
  case "$OUT" in
    *"_kerghan()"*"complete -o nospace -F _kerghan kerghan"*) ;;
    *)
      echo "$OUT" >&2
      return 1
      ;;
  esac
}

@test "contract _kerghan: sourcing the script defines _kerghan and registers it" {
  source_completion
  [ "$(type -t _kerghan)" = "function" ]
  run complete -p kerghan
  [ "$status" -eq 0 ]
  [ "$output" = "complete -o nospace -F _kerghan kerghan" ]
}

@test "contract complete -o nospace -F _kerghan kg: an alias completes like kerghan" {
  source_completion
  complete -o nospace -F _kerghan kg
  local kg kerghan
  reply_of kg ''
  kg="$REPLY_TEXT"
  reply_of kerghan ''
  kerghan="$REPLY_TEXT"
  [ -n "$kerghan" ]
  [ "$kg" = "$kerghan" ]

  reply_of kg up ''
  kg="$REPLY_TEXT"
  reply_of kerghan up ''
  kerghan="$REPLY_TEXT"
  [ -n "$kerghan" ]
  [ "$kg" = "$kerghan" ]

  reply_of kg configure variant =
  kg="$REPLY_TEXT"
  reply_of kerghan configure variant =
  kerghan="$REPLY_TEXT"
  [ -n "$kerghan" ]
  [ "$kg" = "$kerghan" ]
}

@test "error: missing shell" {
  assert_usage_error "missing shell (supported: bash)" completion
}

@test "error: unsupported shell zsh" {
  assert_usage_error "unsupported shell 'zsh' (supported: bash)" completion zsh
}

@test "error: unsupported shell fish" {
  assert_usage_error "unsupported shell 'fish' (supported: bash)" completion fish
}

@test "error: quoted as typed" {
  assert_usage_error "unsupported shell 'Bash' (supported: bash)" completion Bash
}

@test "error: unknown option -x" {
  assert_usage_error "unknown option '-x'" completion -x
}

@test "error: unknown option --help" {
  assert_usage_error "unknown option '--help'" completion --help
}

@test "error: extra argument" {
  assert_usage_error "unexpected argument 'extra'" completion bash extra
}

@test "error: order of checks, an unsupported shell wins over an extra argument" {
  assert_usage_error "unsupported shell 'zsh' (supported: bash)" completion zsh extra
}

@test "error: order of checks, an unknown option wins over an extra argument" {
  assert_usage_error "unknown option '-x'" completion -x extra
}

@test "usage line: kerghan help lists completion bash between wizard and version" {
  local line='  completion bash                 print the bash completion script (load it with: eval "$(kerghan completion bash)")'
  run "$KERGHAN" help
  [ "$status" -eq 0 ]
  local n=0 wizard=0 completion=0 version=0 text
  while IFS= read -r text; do
    n=$((n + 1))
    case "$text" in
      "  wizard "*) wizard="$n" ;;
      "  version "*) version="$n" ;;
    esac
    if [ "$text" = "$line" ]; then
      completion="$n"
    fi
  done <<OUTPUT
$output
OUTPUT
  [ "$wizard" -gt 0 ]
  [ "$completion" -gt "$wizard" ]
  [ "$version" -gt "$completion" ]
}

@test "no side effects: completion bash calls no tool and writes nothing" {
  local before after
  before="$(find "$HOME" | sort)"
  run_split completion bash
  [ "$status" -eq 0 ]
  after="$(find "$HOME" | sort)"
  [ ! -s "$STUB_LOG" ]
  [ "$before" = "$after" ]
  [ ! -e "$HOME/.kerghan" ]
}

@test "fixed text: the output is the same bytes whatever the environment" {
  local a="$TEST_ROOT/a" b="$TEST_ROOT/b"
  mkdir -p "$a/home" "$a/pwd" "$b/home/.kerghan" "$b/pwd"
  printf 'port=4000\nvariant=offline\n' >"$b/home/.kerghan/config"
  (
    cd "$a/pwd"
    env HOME="$a/home" XDG_DATA_HOME="$a/data" KERGHAN_VERSION=1.0.0 \
      KERGHAN_INSTALL_DIR="$a/bin" KERGHAN_COMPLETION=true \
      "$KERGHAN" completion bash >"$TEST_ROOT/out-a"
  )
  (
    cd "$b/pwd"
    env HOME="$b/home" XDG_DATA_HOME="$b/data" KERGHAN_VERSION=9.9.9 \
      KERGHAN_INSTALL_DIR="$b/bin" KERGHAN_COMPLETION=false KERGHAN_HOME="$b/home/.kerghan" \
      "$KERGHAN" completion bash >"$TEST_ROOT/out-b"
  )
  [ -s "$TEST_ROOT/out-a" ]
  diff "$TEST_ROOT/out-a" "$TEST_ROOT/out-b"
}
