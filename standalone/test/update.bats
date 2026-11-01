#!/usr/bin/env bats
# kerghan update [VERSION] and its hidden update --finish step
# (docs/agents/standalone/client-update.md): parsing, preconditions, resolution
# through the installer stamp line, comparison, downgrades, the installer run,
# the handoff, the env step, the pull, the restart decision and the hints.
#
# Every test runs a copy of the client in a temporary install dir; the curl
# stub serves a fake installer that replaces it with the real client re-pinned
# to the target version, so the handoff runs the real update --finish.
# shellcheck disable=SC2030,SC2031 # each test exports its own stub variables

load helpers/setup

eval "base_$(declare -f setup)"
eval "base_$(declare -f teardown)"

RELEASES_URL="https://github.com/darthjee/kerghan/releases"
LATEST_URL="$RELEASES_URL/latest/download/install.sh"

# FIRST_UPDATE_VERSION - read from the client; BELOW_FIRST_VERSION is a release
# before it (no update --finish there).
FIRST_UPDATE_VERSION="$(sed -n 's/^FIRST_UPDATE_VERSION="\([0-9.]*\)"$/\1/p' "$KERGHAN")"
IFS=. read -r _fmajor _fminor _fpatch <<<"$FIRST_UPDATE_VERSION"
if [ "$_fpatch" -gt 0 ]; then
  BELOW_FIRST_VERSION="$_fmajor.$_fminor.$((_fpatch - 1))"
elif [ "$_fminor" -gt 0 ]; then
  BELOW_FIRST_VERSION="$_fmajor.$((_fminor - 1)).0"
else
  BELOW_FIRST_VERSION="$((_fmajor - 1)).0.0"
fi

# HIGH_VERSION - newer than NEWER_VERSION: the old client of a downgrade to
# NEWER_VERSION (which ships update --finish).
HIGH_VERSION="$_major.$((_minor + 2)).0"
NEWER_IMAGE="$IMAGE_REPO:$NEWER_VERSION"

setup() {
  base_setup
  cp "$BATS_TEST_DIRNAME/stubs/curl" "$STUB_BIN/"
  chmod +x "$STUB_BIN/curl"
  export TMPDIR="$TEST_ROOT/tmp"
  mkdir -p "$TMPDIR" "$TEST_ROOT/install"
  INSTALL_DIR="$(cd -P "$TEST_ROOT/install" && pwd -P)"
  CLIENT="$INSTALL_DIR/kerghan"
  export STUB_CLIENT_SOURCE="$KERGHAN"
  export STUB_LATEST_VERSION="$NEWER_VERSION"
  unset STUB_CURL_FAIL_URL STUB_CURL_NETWORK_FAIL STUB_INSTALLER_STAMP STUB_INSTALLER_BODY \
    STUB_INSTALLER_EXIT STUB_INSTALLER_RESULT STUB_INSTALLER_KILL STUB_DOCKER_INFO_EXIT \
    STUB_DOCKER_PULL_EXIT STUB_CONTAINER_ID KERGHAN_UPDATE_FROM KERGHAN_UPDATE_RESTART \
    KERGHAN_UPDATE_SOMETHING KERGHAN_VERSION KERGHAN_INSTALL_DIR
  install_client "$CURRENT_VERSION"
}

teardown() {
  chmod -R u+w "$TEST_ROOT" 2>/dev/null || true
  base_teardown
}

# install_client <version> [path] - a copy of the client pinned to <version>.
install_client() {
  local path="${2:-$CLIENT}"
  sed "s/^KERGHAN_VERSION=\"[^\"]*\"\$/KERGHAN_VERSION=\"$1\"/" "$KERGHAN" >"$path"
  chmod 755 "$path"
}

# release_url <version> - the install.sh URL of <version>.
release_url() {
  echo "$RELEASES_URL/download/$1/install.sh"
}

# client_version - the KERGHAN_VERSION pinned in the installed client.
client_version() {
  sed -n 's/^KERGHAN_VERSION="\([^"]*\)"$/\1/p' "$CLIENT"
}

# curl_calls - the number of curl calls logged.
curl_calls() {
  grep -c '^curl ' "$STUB_LOG" || true
}

# assert_no_staging - no kerghan-update.* staging folder is left in TMPDIR.
assert_no_staging() {
  if ls -d "$TMPDIR"/kerghan-update.* >/dev/null 2>&1; then
    echo "staging folder left behind:" >&2
    ls -A "$TMPDIR" >&2
    return 1
  fi
}

# assert_logged_like <glob> - a STUB_LOG line matches <glob>.
assert_logged_like() {
  local line
  while IFS= read -r line; do
    # shellcheck disable=SC2254 # $1 is a glob on purpose
    case "$line" in
      $1) return 0 ;;
    esac
  done <"$STUB_LOG"
  echo "expected a stub call like: $1" >&2
  echo "--- stub log ---" >&2
  cat "$STUB_LOG" >&2
  return 1
}

# assert_restarted / refute_restarted - `vault up` was (not) called.
assert_restarted() {
  grep -q '^vault up ' "$STUB_LOG" || {
    echo "expected a restart (vault up)" >&2
    cat "$STUB_LOG" >&2
    return 1
  }
}
refute_restarted() {
  refute_logged_prefix "vault up"
}

# line_of <text> - the number of the first output line containing <text>.
line_of() {
  printf '%s\n' "$output" | grep -nF -- "$1" | head -n 1 | cut -d: -f1
}

# assert_order <text>... - each text appears in the output after the previous.
assert_order() {
  local prev=0 n text
  for text in "$@"; do
    n="$(line_of "$text")"
    if [ -z "$n" ] || [ "$n" -le "$prev" ]; then
      echo "expected '$text' after line $prev (found: ${n:-none})" >&2
      echo "--- output ---" >&2
      echo "$output" >&2
      return 1
    fi
    prev="$n"
  done
}

# assert_downgrade_warning <from> <to> - the four downgrade warning lines.
assert_downgrade_warning() {
  assert_output_contains "kerghan: warning: downgrading kerghan $1 -> $2"
  assert_output_contains "kerghan: warning: older versions may have security issues that later releases fixed"
  assert_output_contains "kerghan: warning: config keys added after $2 are reported as unknown (and ignored) by it"
  assert_output_contains "kerghan: warning: the instance is not restarted on a downgrade: switch it by hand afterwards"
}

# --- Usage and parsing ------------------------------------------------------

@test "help lists the update synopsis and options, not --finish" {
  run "$KERGHAN" help
  [ "$status" -eq 0 ]
  assert_output_contains "  update [VERSION] [--force] [--yes] [--[no-]restart]
                                  update the client and the image to VERSION (default: the latest release)
  update-env "
  assert_output_contains "Options for update:
  VERSION            release to install, x.y.z (default: the latest release)
  --force            reinstall even when already on that version
  --yes              confirm a downgrade without asking
  --restart          restart a running instance afterwards (overrides restart-on-update)
  --no-restart       leave a running instance as it is (overrides restart-on-update)
"
  refute_output_contains "--finish"
}

@test "two VERSIONs are a usage error before any download" {
  run "$CLIENT" update "$NEWER_VERSION" "$HIGH_VERSION"
  [ "$status" -eq 2 ]
  assert_output_contains "kerghan: error: only one VERSION can be given"
  assert_output_contains "Usage: kerghan"
  [ "$(curl_calls)" -eq 0 ]
}

@test "--restart with --no-restart is a usage error before any download" {
  run "$CLIENT" update --restart --no-restart
  [ "$status" -eq 2 ]
  assert_output_contains "kerghan: error: options '--restart' and '--no-restart' cannot be combined"
  assert_output_contains "Usage: kerghan"
  [ "$(curl_calls)" -eq 0 ]
}

@test "an unknown option is a usage error before any download" {
  run "$CLIENT" update --bogus
  [ "$status" -eq 2 ]
  assert_output_contains "kerghan: error: unknown option '--bogus'"
  assert_output_contains "Usage: kerghan"
  [ "$(curl_calls)" -eq 0 ]
}

@test "options are accepted before and after VERSION" {
  run "$CLIENT" update --no-restart "$NEWER_VERSION" --yes </dev/null
  [ "$status" -eq 0 ]
  assert_logged_like "curl * $(release_url "$NEWER_VERSION")"
}

@test "--finish with any other argument is a usage error" {
  run "$CLIENT" update --finish extra
  [ "$status" -eq 2 ]
  assert_output_contains "Usage: kerghan"
  run "$CLIENT" update "$NEWER_VERSION" --finish
  [ "$status" -eq 2 ]
  assert_output_contains "Usage: kerghan"
  [ "$(curl_calls)" -eq 0 ]
  refute_logged_prefix "docker"
}

# --- VERSION validation -----------------------------------------------------

@test "invalid VERSIONs are usage errors before any download" {
  local v
  for v in latest 0.9 0.9.0-rc1 vv0.9.0 ../0.9.0 '0.9.0?x' '0.9.0#x' '0.9.0%2e' '0.9.0 x' '' \
    "0.9.0
x"; do
    run "$CLIENT" update "$v"
    echo "case: '$v'" >&2
    [ "$status" -eq 2 ]
    assert_output_contains "kerghan: error: invalid version '$v' (expected x.y.z, e.g. 0.9.0)"
    assert_output_contains "Usage: kerghan"
  done
  [ "$(curl_calls)" -eq 0 ]
}

@test "VERSION accepts one leading v" {
  run "$CLIENT" update "v$NEWER_VERSION" </dev/null
  [ "$status" -eq 0 ]
  assert_logged_like "curl * $(release_url "$NEWER_VERSION")"
  assert_output_contains "Updating kerghan $CURRENT_VERSION -> $NEWER_VERSION..."
}

# --- Preconditions ----------------------------------------------------------

@test "an invalid config fails before any download" {
  write_config "port=abc"
  run "$CLIENT" update
  [ "$status" -eq 1 ]
  assert_output_contains "kerghan: error: $CONFIG_FILE:1: invalid port 'abc' (expected 1-65535)"
  [ "$(curl_calls)" -eq 0 ]
}

@test "a client whose real file is not named kerghan is refused before any download" {
  mv "$CLIENT" "$INSTALL_DIR/kerghan-9.9.9"
  mkdir -p "$TEST_ROOT/links"
  ln -s "$INSTALL_DIR/kerghan-9.9.9" "$TEST_ROOT/links/kerghan"
  run "$TEST_ROOT/links/kerghan" update
  [ "$status" -eq 1 ]
  assert_output_contains "kerghan: error: this client runs from $INSTALL_DIR/kerghan-9.9.9, not a file named 'kerghan'"
  assert_output_contains "kerghan: hint: reinstall with KERGHAN_INSTALL_DIR=<dir> and the installer (curl -fsSL $LATEST_URL | bash)"
  [ "$(curl_calls)" -eq 0 ]
}

@test "a non-writable install dir is refused before any download" {
  chmod 555 "$INSTALL_DIR"
  if [ "$(id -u)" -eq 0 ]; then
    # root can write anywhere: run the client as nobody.
    command -v su >/dev/null 2>&1 || skip "running as root without su"
    chmod 755 "$TEST_ROOT" "$HOME"
    run su -p -s "$BASH" nobody -c '"$0" update' "$CLIENT"
  else
    run "$CLIENT" update
  fi
  [ "$status" -eq 1 ]
  assert_output_contains "kerghan: error: $INSTALL_DIR is not writable"
  assert_output_contains "kerghan: hint: kerghan update installs to $INSTALL_DIR, where this client runs from; it never uses sudo"
  [ "$(curl_calls)" -eq 0 ]
}

# --- Resolution -------------------------------------------------------------

@test "without VERSION the latest install.sh is downloaded once, over HTTPS only, to the staging folder" {
  run "$CLIENT" update </dev/null
  [ "$status" -eq 0 ]
  [ "$(curl_calls)" -eq 1 ]
  assert_logged_like "curl -fsSL --proto =https --proto-redir =https -o $TMPDIR/kerghan-update.*/install.sh -w %{http_code} $LATEST_URL"
  assert_no_staging
}

@test "a 404 for a given VERSION says it does not exist" {
  cp "$CLIENT" "$TEST_ROOT/before"
  export STUB_CURL_FAIL_URL="/download/9.9.9/"
  run "$CLIENT" update 9.9.9
  [ "$status" -eq 1 ]
  assert_output_contains "kerghan: error: version 9.9.9 does not exist"
  assert_output_contains "kerghan: hint: see $RELEASES_URL for the available versions"
  cmp "$CLIENT" "$TEST_ROOT/before"
  assert_no_staging
}

@test "a 404 for the latest release says no release was found" {
  export STUB_CURL_FAIL_URL="/latest/"
  run "$CLIENT" update
  [ "$status" -eq 1 ]
  assert_output_contains "kerghan: error: no release found at $LATEST_URL"
  [ "$(client_version)" = "$CURRENT_VERSION" ]
  assert_no_staging
}

@test "a network failure says the download failed" {
  export STUB_CURL_NETWORK_FAIL=1
  run "$CLIENT" update
  [ "$status" -eq 1 ]
  assert_output_contains "kerghan: error: could not download $LATEST_URL"
  assert_output_contains "kerghan: hint: check your network connection and that github.com is reachable, then try again"
  [ "$(client_version)" = "$CURRENT_VERSION" ]
  assert_no_staging
}

@test "an empty, stamp-less or malformed installer fails with nothing changed" {
  cp "$CLIENT" "$TEST_ROOT/before"
  local stamp
  export STUB_INSTALLER_BODY=empty
  run "$CLIENT" update
  [ "$status" -eq 1 ]
  assert_output_contains "kerghan: error: $LATEST_URL has no KERGHAN_VERSION=\"x.y.z\" line; nothing was changed"
  unset STUB_INSTALLER_BODY
  for stamp in "" 'KERGHAN_VERSION="0.9"' "KERGHAN_VERSION=$NEWER_VERSION" "  KERGHAN_VERSION=\"$NEWER_VERSION\""; do
    export STUB_INSTALLER_STAMP="$stamp"
    run "$CLIENT" update
    echo "case: '$stamp'" >&2
    [ "$status" -eq 1 ]
    assert_output_contains "has no KERGHAN_VERSION=\"x.y.z\" line; nothing was changed"
  done
  refute_logged_prefix "installer"
  cmp "$CLIENT" "$TEST_ROOT/before"
  assert_no_staging
}

@test "a stamp other than the requested VERSION fails with nothing changed" {
  export STUB_INSTALLER_STAMP="KERGHAN_VERSION=\"$HIGH_VERSION\""
  run "$CLIENT" update "$NEWER_VERSION"
  [ "$status" -eq 1 ]
  assert_output_contains "kerghan: error: $(release_url "$NEWER_VERSION") is for version $HIGH_VERSION, not $NEWER_VERSION; nothing was changed"
  refute_logged_prefix "installer"
  [ "$(client_version)" = "$CURRENT_VERSION" ]
  assert_no_staging
}

# --- Comparison -------------------------------------------------------------

@test "already up to date is a cheap no-op: one curl call, no installer, no docker" {
  export STUB_LATEST_VERSION="$CURRENT_VERSION"
  cp "$CLIENT" "$TEST_ROOT/before"
  run "$CLIENT" update
  [ "$status" -eq 0 ]
  [ "$output" = "kerghan $CURRENT_VERSION is already up to date." ]
  [ "$(curl_calls)" -eq 1 ]
  refute_logged_prefix "installer"
  refute_logged_prefix "docker"
  cmp "$CLIENT" "$TEST_ROOT/before"
  assert_no_staging

  : >"$STUB_LOG"
  run "$CLIENT" update "$CURRENT_VERSION" --yes --restart
  [ "$status" -eq 0 ]
  [ "$output" = "kerghan $CURRENT_VERSION is already up to date." ]
  refute_logged_prefix "docker"
}

# The same-version tests run a client at NEWER_VERSION, which ships update
# --finish (CURRENT_VERSION may still be below FIRST_UPDATE_VERSION).
@test "--force reinstalls the same version" {
  install_client "$NEWER_VERSION"
  write_env_file
  run "$CLIENT" update --force </dev/null
  [ "$status" -eq 0 ]
  assert_output_contains "Reinstalling kerghan $NEWER_VERSION..."
  assert_logged_like "installer * KERGHAN_VERSION=$NEWER_VERSION KERGHAN_INSTALL_DIR=$INSTALL_DIR"
  assert_output_contains "kerghan $NEWER_VERSION reinstalled"
}

@test "a latest release older than the client is not a downgrade, even with --force" {
  export STUB_LATEST_VERSION="$OLDER_VERSION"
  local flag
  for flag in "" --force; do
    run "$CLIENT" update ${flag:+"$flag"}
    [ "$status" -eq 0 ]
    assert_output_contains "kerghan $CURRENT_VERSION is newer than the latest release $OLDER_VERSION; nothing to do."
    assert_output_contains "kerghan: hint: run 'kerghan update $OLDER_VERSION' to downgrade to it"
  done
  refute_logged_prefix "installer"
  refute_logged_prefix "docker"
  assert_no_staging
}

@test "a non-release client warns and updates without comparing or confirming" {
  install_client dev
  run "$CLIENT" update </dev/null
  [ "$status" -eq 0 ]
  assert_output_contains "kerghan: warning: this client (dev) is not a release; updating to $NEWER_VERSION without comparing versions"
  assert_output_contains "Updating kerghan dev -> $NEWER_VERSION..."
  refute_output_contains "Downgrade"
  [ "$(client_version)" = "$NEWER_VERSION" ]
}

# --- Downgrade --------------------------------------------------------------

@test "a downgrade on a TTY runs after y" {
  install_client "$HIGH_VERSION"
  write_env_file
  export KERGHAN_ASSUME_TTY=true
  run "$CLIENT" update "$NEWER_VERSION" <<<"y"
  [ "$status" -eq 0 ]
  assert_downgrade_warning "$HIGH_VERSION" "$NEWER_VERSION"
  assert_output_contains "Downgrade to $NEWER_VERSION? [y/N] "
  assert_output_contains "Downgrading kerghan $HIGH_VERSION -> $NEWER_VERSION..."
  [ "$(client_version)" = "$NEWER_VERSION" ]
}

@test "a downgrade answered n, with Enter or at end of input is cancelled" {
  install_client "$HIGH_VERSION"
  export KERGHAN_ASSUME_TTY=true
  local answer
  for answer in n no "" maybe; do
    run "$CLIENT" update "$NEWER_VERSION" <<<"$answer"
    echo "case: '$answer'" >&2
    [ "$status" -eq 1 ]
    assert_downgrade_warning "$HIGH_VERSION" "$NEWER_VERSION"
    assert_output_contains "Downgrade cancelled; nothing was changed."
  done
  run "$CLIENT" update "$NEWER_VERSION" </dev/null
  [ "$status" -eq 1 ]
  assert_output_contains "Downgrade cancelled; nothing was changed."
  refute_logged_prefix "installer"
  [ "$(client_version)" = "$HIGH_VERSION" ]
  assert_no_staging
}

@test "a downgrade without a TTY needs --yes" {
  install_client "$HIGH_VERSION"
  run "$CLIENT" update "$NEWER_VERSION" </dev/null
  [ "$status" -eq 1 ]
  assert_downgrade_warning "$HIGH_VERSION" "$NEWER_VERSION"
  assert_output_contains "kerghan: error: a downgrade needs a confirmation, but stdin is not a terminal"
  assert_output_contains "kerghan: hint: run 'kerghan update $NEWER_VERSION --yes' to confirm it"
  refute_logged_prefix "installer"
  assert_no_staging

  write_env_file
  run "$CLIENT" update "$NEWER_VERSION" --yes </dev/null
  [ "$status" -eq 0 ]
  assert_downgrade_warning "$HIGH_VERSION" "$NEWER_VERSION"
  refute_output_contains "Downgrade to"
  [ "$(client_version)" = "$NEWER_VERSION" ]
}

@test "--force does not skip the downgrade confirmation" {
  install_client "$HIGH_VERSION"
  export KERGHAN_ASSUME_TTY=true
  run "$CLIENT" update "$NEWER_VERSION" --force <<<"n"
  [ "$status" -eq 1 ]
  assert_output_contains "Downgrade to $NEWER_VERSION? [y/N] "
  assert_output_contains "Downgrade cancelled; nothing was changed."
  [ "$(client_version)" = "$HIGH_VERSION" ]
}

@test "a downgrade never restarts a running instance, even with always or --restart" {
  install_client "$HIGH_VERSION"
  write_env_file
  write_config "restart-on-update=always"
  export STUB_RUNNING_IMAGE="$IMAGE_REPO:$HIGH_VERSION"
  run "$CLIENT" update "$NEWER_VERSION" --yes --restart </dev/null
  [ "$status" -eq 0 ]
  assert_output_contains "kerghan: warning: --restart is ignored on a downgrade"
  refute_restarted
  assert_logged "docker pull $NEWER_IMAGE"
  assert_order "kerghan updated $HIGH_VERSION -> $NEWER_VERSION" \
    "kerghan: hint: run 'kerghan down && kerghan up' to switch the instance to $NEWER_VERSION (an older version may not read data written by a newer one)"
  refute_output_contains "docker image rm"
}

@test "a downgrade with a stopped instance hints at kerghan up" {
  install_client "$HIGH_VERSION"
  write_env_file
  run "$CLIENT" update "$NEWER_VERSION" --yes </dev/null
  [ "$status" -eq 0 ]
  refute_restarted
  assert_order "kerghan updated $HIGH_VERSION -> $NEWER_VERSION" \
    "kerghan: hint: run 'kerghan up' to start the instance on $NEWER_VERSION"
  refute_output_contains "docker image rm"
}

@test "a downgrade below FIRST_UPDATE_VERSION only replaces the client" {
  install_client "$NEWER_VERSION"
  write_env_file
  export STUB_RUNNING_IMAGE="$NEWER_IMAGE"
  run "$CLIENT" update "$BELOW_FIRST_VERSION" --yes --restart </dev/null
  [ "$status" -eq 0 ]
  assert_downgrade_warning "$NEWER_VERSION" "$BELOW_FIRST_VERSION"
  assert_output_contains "kerghan: warning: --restart is ignored on a downgrade"
  assert_logged_like "installer * KERGHAN_VERSION=$BELOW_FIRST_VERSION KERGHAN_INSTALL_DIR=$INSTALL_DIR"
  assert_order "kerghan client replaced: $NEWER_VERSION -> $BELOW_FIRST_VERSION" \
    "kerghan: hint: run 'kerghan down && kerghan up' to switch the instance to $BELOW_FIRST_VERSION"
  refute_logged_prefix "docker pull"
  refute_restarted
  refute_output_contains "kerghan updated"
  [ "$(client_version)" = "$BELOW_FIRST_VERSION" ]
  assert_no_staging

  install_client "$NEWER_VERSION"
  unset STUB_RUNNING_IMAGE
  run "$CLIENT" update "$BELOW_FIRST_VERSION" --yes </dev/null
  [ "$status" -eq 0 ]
  assert_output_contains "kerghan: hint: run 'kerghan up' to start the instance on $BELOW_FIRST_VERSION"
}

# --- Install and handoff ----------------------------------------------------

@test "the installer gets the target and the real install dir, never the caller's values" {
  export STUB_INSTALLER_RESULT=recorder
  export KERGHAN_VERSION=9.9.9 KERGHAN_INSTALL_DIR="$TEST_ROOT/elsewhere"
  run "$CLIENT" update
  [ "$status" -eq 0 ]
  assert_logged_like "installer \$0=$TMPDIR/kerghan-update.*/install.sh KERGHAN_VERSION=$NEWER_VERSION KERGHAN_INSTALL_DIR=$INSTALL_DIR"
  [ ! -e "$TEST_ROOT/elsewhere" ]
}

@test "the handoff execs <install dir>/kerghan update --finish with the staging folder removed" {
  export STUB_INSTALLER_RESULT=recorder
  export KERGHAN_UPDATE_FROM=1.2.3 KERGHAN_UPDATE_RESTART=always
  run "$CLIENT" update
  [ "$status" -eq 0 ]
  assert_logged "finish \$0=$INSTALL_DIR/kerghan args=update --finish FROM=$CURRENT_VERSION RESTART=<unset> staging=none"
  assert_no_staging
}

@test "--restart and --no-restart reach the handoff as always and never" {
  export STUB_INSTALLER_RESULT=recorder
  export KERGHAN_UPDATE_RESTART=never
  run "$CLIENT" update --restart
  [ "$status" -eq 0 ]
  assert_logged "finish \$0=$INSTALL_DIR/kerghan args=update --finish FROM=$CURRENT_VERSION RESTART=always staging=none"

  install_client "$CURRENT_VERSION"
  : >"$STUB_LOG"
  export KERGHAN_UPDATE_RESTART=always
  run "$CLIENT" update --no-restart
  [ "$status" -eq 0 ]
  assert_logged "finish \$0=$INSTALL_DIR/kerghan args=update --finish FROM=$CURRENT_VERSION RESTART=never staging=none"
}

@test "a client run through a symlink updates the real file and keeps the link" {
  export STUB_INSTALLER_RESULT=recorder
  mkdir -p "$TEST_ROOT/links"
  ln -s "$CLIENT" "$TEST_ROOT/links/kerghan"
  run "$TEST_ROOT/links/kerghan" update
  [ "$status" -eq 0 ]
  assert_logged_like "installer * KERGHAN_INSTALL_DIR=$INSTALL_DIR"
  assert_logged_like "finish \$0=$INSTALL_DIR/kerghan args=update --finish *"
  [ -L "$TEST_ROOT/links/kerghan" ]

  install_client "$CURRENT_VERSION"
  : >"$STUB_LOG"
  rm "$TEST_ROOT/links/kerghan"
  ln -s ../install/kerghan "$TEST_ROOT/links/kerghan"
  run "$TEST_ROOT/links/kerghan" update
  [ "$status" -eq 0 ]
  assert_logged_like "installer * KERGHAN_INSTALL_DIR=$INSTALL_DIR"
  assert_logged_like "finish \$0=$INSTALL_DIR/kerghan args=update --finish *"
  [ -L "$TEST_ROOT/links/kerghan" ]
}

@test "a client run as 'bash kerghan' from its directory gets the absolute install dir" {
  export STUB_INSTALLER_RESULT=recorder
  run bash -c 'cd "$1" && "$BASH" kerghan update' _ "$INSTALL_DIR"
  [ "$status" -eq 0 ]
  assert_logged_like "installer * KERGHAN_INSTALL_DIR=$INSTALL_DIR"
  assert_logged_like "finish \$0=$INSTALL_DIR/kerghan args=update --finish *"
}

@test "a client run by a relative path ignores a CDPATH with a decoy bin directory" {
  export STUB_INSTALLER_RESULT=recorder
  mkdir -p "$TEST_ROOT/project/bin" "$TEST_ROOT/decoy/bin"
  local project_bin
  project_bin="$(CDPATH='' cd -P -- "$TEST_ROOT/project/bin" && pwd -P)"
  install_client "$CURRENT_VERSION" "$project_bin/kerghan"
  run bash -c 'cd "$1" && CDPATH="$2" "$BASH" bin/kerghan update' _ \
    "$TEST_ROOT/project" "$TEST_ROOT/decoy"
  [ "$status" -eq 0 ]
  assert_logged_like "installer * KERGHAN_INSTALL_DIR=$project_bin"
  assert_logged_like "finish \$0=$project_bin/kerghan args=update --finish *"
  [ ! -e "$TEST_ROOT/decoy/bin/kerghan" ]
}

@test "another kerghan first on PATH is never run by the handoff" {
  export STUB_INSTALLER_RESULT=recorder
  mkdir -p "$TEST_ROOT/shadow"
  printf '#!/usr/bin/env bash\necho "shadow kerghan $*" >>"$STUB_LOG"\n' >"$TEST_ROOT/shadow/kerghan"
  chmod 755 "$TEST_ROOT/shadow/kerghan"
  PATH="$TEST_ROOT/shadow:$PATH" run "$CLIENT" update
  [ "$status" -eq 0 ]
  refute_logged_prefix "shadow"
  assert_logged_like "finish \$0=$INSTALL_DIR/kerghan args=update --finish *"
}

# --- Full flow --------------------------------------------------------------

@test "a full upgrade installs, hands off, updates the env, pulls, restarts and reports, in order" {
  write_legacy_env_file
  write_config "restart-on-update=always"
  export STUB_RUNNING_IMAGE="$IMAGE"
  run "$CLIENT" update </dev/null
  [ "$status" -eq 0 ]
  assert_order "Updating kerghan $CURRENT_VERSION -> $NEWER_VERSION..." \
    "kerghan-install: downloading kerghan $NEWER_VERSION" \
    "kerghan-install: kerghan $NEWER_VERSION installed to $INSTALL_DIR/kerghan" \
    "Added to $ENV_FILE:" \
    "pulled $NEWER_IMAGE" \
    "upgrading $IMAGE -> $NEWER_IMAGE" \
    "Kerghan is running at http://localhost:3000" \
    "kerghan updated $CURRENT_VERSION -> $NEWER_VERSION" \
    "kerghan: hint: free disk space with 'docker image rm $IMAGE'"
  refute_output_contains "Run 'kerghan down && kerghan up' to apply the change."
  assert_logged "docker pull $NEWER_IMAGE"
  [ "$(grep -E '^(curl|installer|docker pull|vault up)' "$STUB_LOG" | cut -d' ' -f1-2 | tr '\n' ',')" = \
    "curl -fsSL,installer \$0=$(grep -o "$TMPDIR/kerghan-update[^ ]*" "$STUB_LOG" | head -n 1),docker pull,vault up," ]
  [ "$(client_version)" = "$NEWER_VERSION" ]
  assert_no_staging
}

@test "no kerghan.env value is ever printed" {
  write_legacy_env_file "GITHUB_SECRET_THING=very-secret-value"
  write_config "restart-on-update=always"
  export STUB_RUNNING_IMAGE="$IMAGE"
  run "$CLIENT" update </dev/null
  [ "$status" -eq 0 ]
  assert_output_contains "Added to $ENV_FILE:"
  local line value
  while IFS= read -r line; do
    value="${line#*=}"
    case "$value" in
      true | admin) continue ;;
    esac
    refute_output_contains "$value"
  done <"$ENV_FILE"
  [ "$(file_mode "$ENV_FILE")" = "600" ]
  [ "$(sed -n 1p "$ENV_FILE")" = "KERGHAN_SECRET_KEY=existing-secret" ]
  [ "$(sed -n 2p "$ENV_FILE")" = "KERGHAN_INTEGRATIONS_KEY=existing-integrations" ]
  [ "$(sed -n 3p "$ENV_FILE")" = "GITHUB_SECRET_THING=very-secret-value" ]
}

# --- Equal image and missing kerghan.env ------------------------------------

@test "--force on the same version with the image running neither prompts nor restarts" {
  install_client "$NEWER_VERSION"
  export STUB_RUNNING_IMAGE="$NEWER_IMAGE" KERGHAN_ASSUME_TTY=true
  write_env_file
  run "$CLIENT" update --force <<<"y"
  [ "$status" -eq 0 ]
  refute_output_contains "Restart Kerghan now?"
  refute_logged_prefix "vault"
  refute_output_contains "kerghan down && kerghan up"
  refute_output_contains "docker image rm"
  assert_output_contains "kerghan $NEWER_VERSION reinstalled"
}

@test "--force on the same version hints at down && up when keys were added" {
  install_client "$NEWER_VERSION"
  export STUB_RUNNING_IMAGE="$NEWER_IMAGE" KERGHAN_ASSUME_TTY=true
  write_legacy_env_file
  run "$CLIENT" update --force <<<"y"
  [ "$status" -eq 0 ]
  refute_output_contains "Restart Kerghan now?"
  refute_logged_prefix "vault"
  assert_output_contains "kerghan: hint: run 'kerghan down && kerghan up' to apply the new kerghan.env variables"
}

@test "a missing kerghan.env with the data volume warns and never restarts" {
  export STUB_VOLUME_EXISTS=1 STUB_RUNNING_IMAGE="$IMAGE"
  write_config "restart-on-update=always"
  run "$CLIENT" update </dev/null
  [ "$status" -eq 0 ]
  assert_output_contains "kerghan: warning: ~/.kerghan/kerghan.env is missing but the data volume vault-kerghan-data exists"
  assert_output_contains "restore kerghan.env from your backup"
  assert_output_contains "'kerghan reset'"
  refute_restarted
  [ ! -e "$ENV_FILE" ]
  assert_output_contains "kerghan updated $CURRENT_VERSION -> $NEWER_VERSION"
}

# --- Env step ---------------------------------------------------------------

@test "the env step prints nothing when no key is missing" {
  write_env_file
  run "$CLIENT" update </dev/null
  [ "$status" -eq 0 ]
  refute_output_contains "Added to"
  refute_output_contains "is up to date"
  refute_output_contains "to apply the change"
}

@test "the env step is skipped silently without kerghan.env and the data volume" {
  run "$CLIENT" update </dev/null
  [ "$status" -eq 0 ]
  refute_output_contains "kerghan.env"
  [ ! -e "$ENV_FILE" ]
  assert_output_contains "kerghan: hint: run 'kerghan up' to start Kerghan on $NEWER_IMAGE"
}

@test "added keys get the down && up hint when the restart did not recreate the container" {
  write_legacy_env_file
  write_config "restart-on-update=always"
  export STUB_RUNNING_IMAGE="$IMAGE" STUB_CONTAINER_ID=same-container
  run "$CLIENT" update </dev/null
  [ "$status" -eq 0 ]
  assert_restarted
  assert_output_contains "kerghan: hint: run 'kerghan down && kerghan up' to apply the new kerghan.env variables"
  assert_output_contains "kerghan: hint: after 'kerghan up', free disk space with 'docker image rm $IMAGE'"
}

# --- Pull -------------------------------------------------------------------

@test "variant=offline pulls the offline image" {
  write_env_file
  write_config "variant=offline"
  export STUB_RUNNING_IMAGE="$IMAGE"
  run "$CLIENT" update </dev/null
  [ "$status" -eq 0 ]
  assert_logged "docker pull $NEWER_IMAGE-offline"
}

@test "an image-tag override is pulled and warned about" {
  write_env_file
  write_config "image-tag=$OLDER_VERSION"
  run "$CLIENT" update </dev/null
  [ "$status" -eq 0 ]
  assert_output_contains "kerghan: warning: image-tag=$OLDER_VERSION in ~/.kerghan/config still overrides the pinned image tag ($NEWER_VERSION)"
  assert_output_contains "kerghan: hint: run 'kerghan configure --unset image-tag' to use the pinned image"
  assert_logged "docker pull $IMAGE_REPO:$OLDER_VERSION"
}

@test "a pull failure exits 1 without restarting" {
  write_env_file
  write_config "restart-on-update=always"
  export STUB_RUNNING_IMAGE="$IMAGE" STUB_DOCKER_PULL_EXIT=1
  run "$CLIENT" update </dev/null
  [ "$status" -eq 1 ]
  assert_output_contains "kerghan: error: could not pull $NEWER_IMAGE; kerghan was updated to $NEWER_VERSION, the instance was not restarted"
  assert_output_contains "kerghan: hint: run 'kerghan update --force' to try again, or 'kerghan up' (which also pulls it)"
  refute_restarted
  refute_output_contains "kerghan updated"
}

# --- Restart decision -------------------------------------------------------

# restart_case <setting|unset> <tty|notty> <input> <flag|-> <running|stopped>
# <restart|keep> - one update run, checking whether it restarted and prompted.
restart_case() {
  local setting="$1" tty="$2" input="$3" flag="$4" instance="$5" expect="$6"
  echo "case: $*" >&2
  install_client "$CURRENT_VERSION"
  : >"$STUB_LOG"
  rm -f "$CONFIG_FILE"
  if [ "$setting" != "unset" ]; then
    write_config "restart-on-update=$setting"
  fi
  if [ "$tty" = "tty" ]; then
    export KERGHAN_ASSUME_TTY=true
  else
    unset KERGHAN_ASSUME_TTY
  fi
  if [ "$instance" = "running" ]; then
    export STUB_RUNNING_IMAGE="$IMAGE"
  else
    unset STUB_RUNNING_IMAGE
  fi
  local args=()
  [ "$flag" = "-" ] || args+=("$flag")
  run "$CLIENT" update ${args[@]+"${args[@]}"} <<<"$input"
  [ "$status" -eq 0 ]
  local prompts=false
  if [ "$instance" = "running" ] && [ "$tty" = "tty" ] && [ "$flag" = "-" ]; then
    case "$setting" in
      ask | unset) prompts=true ;;
    esac
  fi
  if [ "$prompts" = "true" ]; then
    assert_output_contains "Restart Kerghan now? [Y/n] "
  else
    refute_output_contains "Restart Kerghan now?"
  fi
  if [ "$expect" = "restart" ]; then
    assert_restarted
    assert_output_contains "kerghan: hint: free disk space with 'docker image rm $IMAGE'"
  else
    refute_restarted
    if [ "$instance" = "running" ]; then
      assert_output_contains "kerghan: hint: run 'kerghan up' to restart Kerghan on $NEWER_IMAGE (data is kept)"
      assert_output_contains "kerghan: hint: after 'kerghan up', free disk space with 'docker image rm $IMAGE'"
    else
      assert_output_contains "kerghan: hint: run 'kerghan up' to start Kerghan on $NEWER_IMAGE"
      refute_output_contains "docker image rm"
    fi
  fi
  assert_output_contains "kerghan updated $CURRENT_VERSION -> $NEWER_VERSION"
}

@test "restart matrix: a running instance follows restart-on-update" {
  write_env_file
  restart_case always notty "" - running restart
  restart_case never tty "y" - running keep
  restart_case ask tty "y" - running restart
  restart_case ask tty "Yes" - running restart
  restart_case ask tty "" - running restart
  restart_case ask tty "n" - running keep
  restart_case ask notty "y" - running keep
  restart_case unset tty "y" - running restart
  restart_case unset notty "y" - running keep
}

@test "restart matrix: end of input at the prompt does not restart" {
  write_env_file
  write_config "restart-on-update=ask"
  export STUB_RUNNING_IMAGE="$IMAGE" KERGHAN_ASSUME_TTY=true
  run "$CLIENT" update </dev/null
  [ "$status" -eq 0 ]
  assert_output_contains "Restart Kerghan now? [Y/n] "
  refute_restarted
}

@test "restart matrix: --restart and --no-restart override every value" {
  write_env_file
  local setting
  for setting in always never ask unset; do
    restart_case "$setting" notty "n" --restart running restart
    restart_case "$setting" tty "y" --no-restart running keep
  done
  restart_case ask tty "n" --restart running restart
}

@test "restart matrix: a stopped instance is never started and never prompts" {
  write_env_file
  local setting
  for setting in always never ask unset; do
    restart_case "$setting" tty "y" - stopped keep
    restart_case "$setting" notty "y" - stopped keep
  done
  restart_case ask tty "y" --restart stopped keep
  restart_case ask tty "y" --no-restart stopped keep
  # Not running at all, or a stopped container.
  export STUB_RUNNING_IMAGE="$IMAGE" STUB_RUNNING_STATE=false
  install_client "$CURRENT_VERSION"
  write_config "restart-on-update=always"
  run "$CLIENT" update </dev/null
  [ "$status" -eq 0 ]
  refute_restarted
  assert_output_contains "kerghan: hint: run 'kerghan up' to start Kerghan on $NEWER_IMAGE"
}

@test "a failed restart prints up's hints and exits with its status" {
  write_env_file
  write_config "restart-on-update=always"
  export STUB_RUNNING_IMAGE="$IMAGE" STUB_VAULT_UP_EXIT=3 \
    STUB_VAULT_UP_STDERR="Bind for 127.0.0.1:3000 failed: port is already allocated"
  run "$CLIENT" update </dev/null
  [ "$status" -eq 3 ]
  assert_output_contains "kerghan: hint: use 'kerghan up -p <port>' or set port= in ~/.kerghan/config to pick another port"
  assert_output_contains "kerghan: error: the restart failed; kerghan was updated to $NEWER_VERSION"
  refute_output_contains "kerghan updated"
  [ "$(client_version)" = "$NEWER_VERSION" ]
}

# --- Failures ---------------------------------------------------------------

@test "an installer failure leaves the client unchanged" {
  cp "$CLIENT" "$TEST_ROOT/before"
  export STUB_INSTALLER_EXIT=1
  run "$CLIENT" update </dev/null
  [ "$status" -eq 1 ]
  assert_output_contains "kerghan-install: error: failed to download kerghan $NEWER_VERSION"
  assert_output_contains "kerghan: error: the installer failed; kerghan $CURRENT_VERSION is still installed"
  cmp "$CLIENT" "$TEST_ROOT/before"
  refute_logged_prefix "docker pull"
  assert_no_staging
}

@test "Docker not reachable is refused by the installer with nothing changed" {
  cp "$CLIENT" "$TEST_ROOT/before"
  export STUB_DOCKER_INFO_EXIT=1
  run "$CLIENT" update </dev/null
  [ "$status" -eq 1 ]
  assert_output_contains "kerghan-install: error: cannot reach the Docker daemon"
  assert_output_contains "kerghan: error: the installer failed; kerghan $CURRENT_VERSION is still installed"
  cmp "$CLIENT" "$TEST_ROOT/before"
}

@test "a missing or non-executable new client fails the handoff" {
  local result
  for result in missing noexec; do
    install_client "$CURRENT_VERSION"
    export STUB_INSTALLER_RESULT="$result"
    run "$CLIENT" update </dev/null
    echo "case: $result" >&2
    [ "$status" -eq 1 ]
    assert_output_contains "kerghan: error: could not run $INSTALL_DIR/kerghan update --finish"
    assert_output_contains "kerghan: hint: the client may already be updated: check with 'kerghan version', then run 'kerghan up'"
    assert_no_staging
  done
}

@test "Ctrl-C removes the staging folder and exits 130" {
  export STUB_INSTALLER_KILL=INT
  run "$CLIENT" update </dev/null
  [ "$status" -eq 130 ]
  assert_no_staging
  [ "$(client_version)" = "$CURRENT_VERSION" ]
}

# --- update --finish --------------------------------------------------------

@test "update --finish by hand reads restart-on-update and reports the installed version" {
  write_env_file
  write_config "restart-on-update=always"
  export STUB_RUNNING_IMAGE="$IMAGE_REPO:$OLDER_VERSION"
  run "$CLIENT" update --finish </dev/null
  [ "$status" -eq 0 ]
  refute_logged_prefix "curl"
  assert_logged "docker pull $IMAGE"
  assert_restarted
  assert_output_contains "kerghan $CURRENT_VERSION is installed"
  assert_output_contains "kerghan: hint: free disk space with 'docker image rm $IMAGE_REPO:$OLDER_VERSION'"
}

@test "update --finish ignores an invalid KERGHAN_UPDATE_RESTART with a warning" {
  write_env_file
  write_config "restart-on-update=never"
  export STUB_RUNNING_IMAGE="$IMAGE_REPO:$OLDER_VERSION" KERGHAN_UPDATE_RESTART=maybe
  run "$CLIENT" update --finish </dev/null
  [ "$status" -eq 0 ]
  assert_output_contains "kerghan: warning: ignoring KERGHAN_UPDATE_RESTART='maybe' (expected always or never)"
  refute_restarted
}

@test "update --finish treats an empty KERGHAN_UPDATE_RESTART as unset, silently" {
  write_env_file
  write_config "restart-on-update=always"
  export STUB_RUNNING_IMAGE="$IMAGE_REPO:$OLDER_VERSION" KERGHAN_UPDATE_RESTART=""
  run "$CLIENT" update --finish </dev/null
  [ "$status" -eq 0 ]
  refute_output_contains "ignoring KERGHAN_UPDATE_RESTART"
  assert_restarted
}

@test "update --finish ignores an unusable KERGHAN_UPDATE_FROM and unknown variables" {
  write_env_file
  local from
  for from in '0.1.0;x' 'a b' "$(printf 'v%.0s' $(seq 1 65))"; do
    export KERGHAN_UPDATE_FROM="$from" KERGHAN_UPDATE_SOMETHING=1
    run "$CLIENT" update --finish </dev/null
    echo "case: '$from'" >&2
    [ "$status" -eq 0 ]
    assert_output_contains "kerghan $CURRENT_VERSION is installed"
    refute_output_contains "$from"
  done
}

@test "update --finish reports an update and a reinstall from KERGHAN_UPDATE_FROM" {
  write_env_file
  KERGHAN_UPDATE_FROM="$OLDER_VERSION" run "$CLIENT" update --finish </dev/null
  [ "$status" -eq 0 ]
  assert_output_contains "kerghan updated $OLDER_VERSION -> $CURRENT_VERSION"
  KERGHAN_UPDATE_FROM="$CURRENT_VERSION" run "$CLIENT" update --finish </dev/null
  [ "$status" -eq 0 ]
  assert_output_contains "kerghan $CURRENT_VERSION reinstalled"
}

@test "update --finish never restarts when KERGHAN_UPDATE_FROM is newer (a downgrade)" {
  write_env_file
  write_config "restart-on-update=always"
  export STUB_RUNNING_IMAGE="$IMAGE_REPO:$NEWER_VERSION" KERGHAN_UPDATE_FROM="$NEWER_VERSION" \
    KERGHAN_UPDATE_RESTART=always
  run "$CLIENT" update --finish </dev/null
  [ "$status" -eq 0 ]
  refute_restarted
  assert_order "kerghan updated $NEWER_VERSION -> $CURRENT_VERSION" \
    "kerghan: hint: run 'kerghan down && kerghan up' to switch the instance to $CURRENT_VERSION"
  refute_output_contains "docker image rm"
}
