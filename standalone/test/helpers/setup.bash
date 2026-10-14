# Shared harness for the kerghan client tests: a temporary HOME, the vault,
# docker and openssl stubs first on PATH, and STUB_LOG assertions.
# The current version is read from the client's KERGHAN_VERSION pin, and the
# older/newer versions are derived from it, so a version bump
# (scripts/bump_version.sh) needs no test changes.
# shellcheck disable=SC2034,SC2154 # KERGHAN etc. are used and $output set by the .bats files

KERGHAN="$BATS_TEST_DIRNAME/../bin/kerghan"
IMAGE_REPO="darthjee/kerghan-standalone"

# CURRENT_VERSION - the CLI's pinned KERGHAN_VERSION (x.y.z).
CURRENT_VERSION="$(sed -n 's/^KERGHAN_VERSION="\([0-9.]*\)"$/\1/p' "$KERGHAN")"
IFS=. read -r _major _minor _patch <<<"$CURRENT_VERSION"

# OLDER_VERSION - a release before CURRENT_VERSION.
if [ "$_patch" -gt 0 ]; then
  OLDER_VERSION="$_major.$_minor.$((_patch - 1))"
elif [ "$_minor" -gt 0 ]; then
  OLDER_VERSION="$_major.$((_minor - 1)).0"
else
  OLDER_VERSION="$((_major - 1)).0.0"
fi

# NEWER_VERSION - a release after CURRENT_VERSION.
NEWER_VERSION="$_major.$((_minor + 1)).0"

# IMAGE - the online image the CLI runs by default.
IMAGE="$IMAGE_REPO:$CURRENT_VERSION"

# ALLOWED_IPS - the KERGHAN_DEFAULT_USER_ALLOWED_IPS value the client passes.
ALLOWED_IPS="127.0.0.1,::1,10.0.0.0/8,172.16.0.0/12,192.168.0.0/16"

# default_user_args <true|false> - the -e words for the client-managed
# default-user variables, as they appear in the vault up line.
default_user_args() {
  echo "-e KERGHAN_DEFAULT_USER_ALWAYS_AUTHENTICATED=$1 -e KERGHAN_DEFAULT_USER_ALLOWED_IPS=$ALLOWED_IPS"
}

# DEFAULT_USER_ARGS - the default-user -e words with auto-login on (default).
DEFAULT_USER_ARGS="$(default_user_args true)"

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
    STUB_RUNNING_HOST_IP STUB_RUNNING_ENV \
    STUB_VAULT_UP_EXIT STUB_VAULT_UP_STDERR
}

teardown() {
  rm -rf "$TEST_ROOT"
}

# write_env_file [extra lines...] - an existing kerghan.env with the default
# user (as written by the current client).
write_env_file() {
  write_legacy_env_file \
    "KERGHAN_DEFAULT_USER_ENABLED=true" \
    "KERGHAN_DEFAULT_USER_USERNAME=admin" \
    "KERGHAN_DEFAULT_USER_EMAIL=admin@kerghan.local" \
    "KERGHAN_DEFAULT_USER_PASSWORD=existing-password-0123456789abcdef" \
    "KERGHAN_DEFAULT_USER_ADMIN=true" \
    ${@+"$@"}
}

# write_legacy_env_file [extra lines...] - an existing kerghan.env created
# before #371: the two secrets only, no default user.
write_legacy_env_file() {
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

# write_config [lines...] - writes ~/.kerghan/config, one argument per line.
write_config() {
  mkdir -p "$HOME/.kerghan"
  CONFIG_FILE="$HOME/.kerghan/config"
  printf '%s\n' "$@" >"$CONFIG_FILE"
}
