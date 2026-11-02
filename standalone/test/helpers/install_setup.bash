# Shared harness for the installer tests: a temporary HOME and TMPDIR, and a
# stub dir (curl, docker, uname; no vault by default) plus a minimal set of
# real tools as the installer's whole PATH, so a real vault, curl or docker on
# the host can never be hit.
# shellcheck disable=SC2034,SC2154 # INSTALLER, CURRENT_VERSION are used and $output set by the .bats files

INSTALLER="$BATS_TEST_DIRNAME/../install.sh"
KERGHAN_CLIENT="$BATS_TEST_DIRNAME/../bin/kerghan"
STANDALONE_DOCKERFILE="$BATS_TEST_DIRNAME/../../dockerfiles/kerghan_standalone/Dockerfile"

setup() {
  TEST_ROOT="$(mktemp -d "$BATS_TMPDIR/kerghan-install-test.XXXXXX")"
  export HOME="$TEST_ROOT/home"
  export TMPDIR="$TEST_ROOT/tmp"
  STUB_BIN="$TEST_ROOT/bin"
  TOOLS_BIN="$TEST_ROOT/tools"
  mkdir -p "$HOME" "$TMPDIR" "$STUB_BIN" "$TOOLS_BIN"
  cp "$BATS_TEST_DIRNAME/stubs/curl" "$BATS_TEST_DIRNAME/stubs/docker" \
    "$BATS_TEST_DIRNAME/stubs/uname" "$STUB_BIN/"
  chmod +x "$STUB_BIN"/*
  local tool
  for tool in bash env cat chmod mkdir mktemp mv rm; do
    ln -s "$(command -v "$tool")" "$TOOLS_BIN/$tool"
  done
  REAL_MV="$(command -v mv)"
  INSTALL_PATH="$STUB_BIN:$TOOLS_BIN"
  export STUB_LOG="$TEST_ROOT/stub.log"
  : >"$STUB_LOG"
  DEFAULT_DIR="$HOME/.local/bin"
  COMPLETION_FILE="$HOME/.local/share/bash-completion/completions/kerghan"
  unset KERGHAN_VERSION KERGHAN_INSTALL_DIR STUB_UNAME STUB_DOCKER_INFO_EXIT \
    STUB_CURL_FAIL_URL STUB_VAULT_INSTALL_EXIT BASH_COMPLETION_USER_DIR \
    XDG_DATA_HOME KERGHAN_COMPLETION STUB_CLIENT_COMPLETION STUB_COMPLETION_DIR
  # A path that never exists, so the bash-completion hint never depends on
  # the container.
  export KERGHAN_BASH_COMPLETION_PATHS="$TEST_ROOT/no-bash-completion"
}

teardown() {
  chmod -R u+w "$TEST_ROOT" 2>/dev/null || true
  rm -rf "$TEST_ROOT"
}

# run_installer - runs install.sh with only INSTALL_PATH on PATH.
run_installer() {
  run env PATH="$INSTALL_PATH" "$INSTALLER"
}

# with_vault - puts the vault stub on the installer's PATH.
with_vault() {
  cp "$BATS_TEST_DIRNAME/stubs/vault" "$STUB_BIN/vault"
  chmod +x "$STUB_BIN/vault"
}

# without_docker - removes the docker stub from the installer's PATH.
without_docker() {
  rm -f "$STUB_BIN/docker"
}

# with_failing_completion_mv [file] - replaces the installer's mv with a
# wrapper that fails when its last argument is the completion file (default
# COMPLETION_FILE) and runs the real mv otherwise. Root-proof, unlike chmod.
with_failing_completion_mv() {
  local target="${1:-$COMPLETION_FILE}"
  rm -f "$TOOLS_BIN/mv"
  {
    echo '#!/usr/bin/env bash'
    printf 'target=%q\nreal_mv=%q\n' "$target" "$REAL_MV"
    # shellcheck disable=SC2016 # written literally into the wrapper
    echo 'if [ "${!#}" = "$target" ]; then'
    echo '  echo "mv: cannot move: simulated failure" >&2'
    echo '  exit 1'
    echo 'fi'
    # shellcheck disable=SC2016 # written literally into the wrapper
    echo 'exec "$real_mv" "$@"'
  } >"$TOOLS_BIN/mv"
  chmod +x "$TOOLS_BIN/mv"
}

# assert_completion_file [path] - a regular file (default COMPLETION_FILE)
# holding the stub client's marker script for CURRENT_VERSION.
assert_completion_file() {
  local file="${1:-$COMPLETION_FILE}"
  if [ -L "$file" ] || [ ! -f "$file" ]; then
    echo "expected a regular completion file at $file" >&2
    return 1
  fi
  if ! grep -qxF -- "# fake kerghan $CURRENT_VERSION completion" "$file"; then
    echo "expected the stub client's completion script in $file" >&2
    echo "--- file ---" >&2
    cat "$file" >&2
    return 1
  fi
}

# assert_logged <exact line>
assert_logged() {
  if ! grep -qxF -- "$1" "$STUB_LOG"; then
    echo "expected stub call: $1" >&2
    echo "--- stub log ---" >&2
    cat "$STUB_LOG" >&2
    return 1
  fi
}

# refute_logged_prefix <prefix> - no STUB_LOG line starts with <prefix>.
refute_logged_prefix() {
  local line
  while IFS= read -r line; do
    case "$line" in
      "$1"*)
        echo "unexpected stub call: $line" >&2
        return 1
        ;;
    esac
  done <"$STUB_LOG"
}

# assert_output_contains <text>
assert_output_contains() {
  case "$output" in
    *"$1"*) ;;
    *)
      echo "expected output to contain: $1" >&2
      echo "--- output ---" >&2
      echo "$output" >&2
      return 1
      ;;
  esac
}

# refute_output_contains <text>
refute_output_contains() {
  case "$output" in
    *"$1"*)
      echo "expected output not to contain: $1" >&2
      echo "--- output ---" >&2
      echo "$output" >&2
      return 1
      ;;
  esac
}

# assert_no_install [dir] - no kerghan client in dir (default ~/.local/bin)
# and the staging dir was cleaned up.
assert_no_install() {
  local dir="${1:-$DEFAULT_DIR}"
  if [ -e "$dir/kerghan" ]; then
    echo "unexpected client at $dir/kerghan" >&2
    return 1
  fi
  assert_staging_cleaned
}

# assert_staging_cleaned - TMPDIR is empty again.
assert_staging_cleaned() {
  if [ -n "$(ls -A "$TMPDIR")" ]; then
    echo "staging dir left behind in $TMPDIR:" >&2
    ls -A "$TMPDIR" >&2
    return 1
  fi
}

# stamped <var> <file> - the value of a `<var>="<value>"` stamp line.
stamped() {
  sed -n "s/^$1=\"\\([0-9.]*\\)\"\$/\\1/p" "$2"
}

# CURRENT_VERSION - the installer's stamped KERGHAN_VERSION, read rather than
# hard-coded so a version bump (scripts/bump_version.sh) needs no test changes.
CURRENT_VERSION="$(stamped KERGHAN_VERSION "$INSTALLER")"
