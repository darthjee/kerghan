# Harness for bin/release_kerghan_standalone.sh: docker stub first on PATH and the
# script sourced (it runs nothing when sourced).
# shellcheck disable=SC2034,SC2154 # variables used by the .bats files

RELEASE_SCRIPT="$BATS_TEST_DIRNAME/../../bin/release_kerghan_standalone.sh"

setup() {
  TEST_ROOT="$(mktemp -d "$BATS_TMPDIR/release-test.XXXXXX")"
  STUB_BIN="$TEST_ROOT/bin"
  mkdir -p "$STUB_BIN"
  cp "$BATS_TEST_DIRNAME/stubs/docker" "$STUB_BIN/"
  chmod +x "$STUB_BIN"/*
  export PATH="$STUB_BIN:$PATH"
  export STUB_LOG="$TEST_ROOT/stub.log"
  : >"$STUB_LOG"
  export STUB_MANIFESTS_DIR="$BATS_TEST_DIRNAME/fixtures"
  unset STUB_ARCH
  # shellcheck disable=SC1090
  source "$RELEASE_SCRIPT"
  IMAGES_DIR="$TEST_ROOT/images"
  mkdir -p "$IMAGES_DIR/amd64" "$IMAGES_DIR/arm64"
}

teardown() {
  rm -rf "$TEST_ROOT"
}

assert_logged() {
  if ! grep -qxF -- "$1" "$STUB_LOG"; then
    echo "expected stub call: $1" >&2
    cat "$STUB_LOG" >&2
    return 1
  fi
}

# refute_logged_prefix <prefix> - no STUB_LOG line starts with <prefix>.
refute_logged_prefix() {
  if grep -q "^$1" "$STUB_LOG"; then
    echo "unexpected stub call with prefix: $1" >&2
    cat "$STUB_LOG" >&2
    return 1
  fi
}
