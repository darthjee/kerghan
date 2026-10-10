# Shared harness for the kerghan client tests: a temporary HOME, the vault,
# docker and openssl stubs first on PATH, and STUB_LOG assertions.
# shellcheck disable=SC2034,SC2154 # KERGHAN is used and $output set by the .bats files

KERGHAN="$BATS_TEST_DIRNAME/../bin/kerghan"

setup() {
  TEST_ROOT="$(mktemp -d "$BATS_TMPDIR/kerghan-test.XXXXXX")"
  export HOME="$TEST_ROOT/home"
  STUB_BIN="$TEST_ROOT/bin"
  mkdir -p "$HOME" "$STUB_BIN"
  cp "$BATS_TEST_DIRNAME/stubs/vault" "$BATS_TEST_DIRNAME/stubs/docker" \
    "$BATS_TEST_DIRNAME/stubs/openssl" "$STUB_BIN/"
  chmod +x "$STUB_BIN"/*
  export PATH="$STUB_BIN:$PATH"
  export STUB_LOG="$TEST_ROOT/stub.log"
  : >"$STUB_LOG"
  ENV_FILE="$HOME/.kerghan/kerghan.env"
  unset STUB_VOLUME_EXISTS STUB_RUNNING_IMAGE STUB_RUNNING_STATE STUB_RUNNING_PORT \
    STUB_VAULT_UP_EXIT STUB_VAULT_UP_STDERR
}

teardown() {
  rm -rf "$TEST_ROOT"
}

# write_env_file [extra lines...] - an existing kerghan.env.
write_env_file() {
  mkdir -p "$HOME/.kerghan"
  {
    echo "KERGHAN_SECRET_KEY=existing-secret"
    echo "KERGHAN_INTEGRATIONS_KEY=existing-integrations"
    local line
    for line in "$@"; do
      echo "$line"
    done
  } >"$ENV_FILE"
  chmod 600 "$ENV_FILE"
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

# vault_calls - only the vault lines of STUB_LOG, in order.
vault_calls() {
  grep '^vault ' "$STUB_LOG" || true
}
