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

# default_user_args <true|false> [cookie-secure] - the -e words for the
# client-managed variables, as they appear in the vault up line. The cookie
# setting defaults to false with auto-login on (a loopback bind) and loopback
# otherwise.
default_user_args() {
  local cookie="${2:-}"
  if [ -z "$cookie" ]; then
    if [ "$1" = "true" ]; then cookie=false; else cookie=loopback; fi
  fi
  echo "-e KERGHAN_DEFAULT_USER_ALWAYS_AUTHENTICATED=$1 -e KERGHAN_DEFAULT_USER_ALLOWED_IPS=$ALLOWED_IPS -e KERGHAN_COOKIE_SECURE=$cookie $(log_args)"
}

# log_args [dir] - the -e / -v words the client passes for the log directory
# (default ~/.kerghan/logs, file logs on), right after the default-user words.
log_args() {
  echo "-e KERGHAN_FILE_LOGS=true -e KERGHAN_HOST_UID=$(id -u) -e KERGHAN_HOST_GID=$(id -g) -v ${1:-$HOME/.kerghan/logs}:/vault/logs"
}

# DEFAULT_USER_ARGS - the default-user -e words with auto-login on (default).
DEFAULT_USER_ARGS="(set in setup, after HOME)"

setup() {
  TEST_ROOT="$(mktemp -d "$BATS_TMPDIR/kerghan-test.XXXXXX")"
  export HOME="$TEST_ROOT/home"
  DEFAULT_USER_ARGS="$(default_user_args true)"
  STUB_BIN="$TEST_ROOT/bin"
  mkdir -p "$HOME" "$STUB_BIN"
  cp "$BATS_TEST_DIRNAME/stubs/vault" "$BATS_TEST_DIRNAME/stubs/docker" \
    "$BATS_TEST_DIRNAME/stubs/openssl" "$BATS_TEST_DIRNAME/stubs/lsof" \
    "$BATS_TEST_DIRNAME/stubs/ss" "$BATS_TEST_DIRNAME/stubs/mktemp" "$STUB_BIN/"
  chmod +x "$STUB_BIN"/*
  export SYSTEM_PATH="$PATH"
  export PATH="$STUB_BIN:$PATH"
  export STUB_LOG="$TEST_ROOT/stub.log"
  : >"$STUB_LOG"
  export KERGHAN_MIGRATE_TIMEOUT=0
  ENV_FILE="$HOME/.kerghan/kerghan.env"
  CONFIG_FILE="$HOME/.kerghan/config"
  unset STUB_VOLUME_EXISTS STUB_RUNNING_IMAGE STUB_RUNNING_STATE STUB_RUNNING_PORT \
    STUB_RUNNING_HOST_IP STUB_RUNNING_ENV STUB_RUNNING_ENV_FAIL \
    STUB_VAULT_UP_EXIT STUB_VAULT_UP_STDERR KERGHAN_ASSUME_TTY STUB_MV_FAIL \
    STUB_LEGACY_VOLUME STUB_LEGACY_EMPTY STUB_LEGACY_RM_EXIT STUB_MIG_FAIL \
    STUB_LSOF_OUTPUT STUB_LSOF_EXIT STUB_SS_OUTPUT STUB_SS_EXIT \
    STUB_LOG_MOUNT STUB_FILE_LOGS STUB_UNWRITABLE_DIR
}

teardown() {
  # hide_listener_tools narrows PATH: restore it before cleaning up.
  [ -z "${SYSTEM_PATH:-}" ] || export PATH="$SYSTEM_PATH"
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

# file_mode <path> - the permission bits of <path> in octal (GNU or BSD stat).
file_mode() {
  stat -c '%a' "$1" 2>/dev/null || stat -f '%Lp' "$1"
}

# make_old <path> - sets the mtime of <path> far in the past, so a later
# `[ <path> -nt "$TEST_ROOT/old-ref" ]` tells whether it was rewritten.
make_old() {
  touch -t 200001010000 "$1"
  touch -t 200101010000 "$TEST_ROOT/old-ref"
}

# hide_lsof - removes the lsof stub, so only ss can be found.
hide_lsof() {
  rm -f "$STUB_BIN/lsof"
  hide_real_listener_tools
}

# hide_listener_tools - neither lsof nor ss can be found: the stubs are removed
# and PATH is reduced to STUB_BIN plus symlinks to the few tools the client
# needs, so the host's real lsof/ss are unreachable.
hide_listener_tools() {
  rm -f "$STUB_BIN/lsof" "$STUB_BIN/ss"
  hide_real_listener_tools
}

# hide_real_listener_tools - PATH = STUB_BIN + a directory of symlinks to the
# host tools, minus lsof and ss.
hide_real_listener_tools() {
  local safe="$TEST_ROOT/safe-bin" tool path
  mkdir -p "$safe"
  for tool in bash env sh awk sort cat grep sed tr mkdir rm cp chmod mktemp date head tail cut wc dirname basename id ls touch stat tee printf readlink; do
    path="$(PATH="$SYSTEM_PATH" command -v "$tool" 2>/dev/null || true)"
    case "$path" in
      /*) ln -sf "$path" "$safe/$tool" ;;
    esac
  done
  export PATH="$STUB_BIN:$safe"
}
