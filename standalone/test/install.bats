#!/usr/bin/env bats
# The installer (standalone/install.sh): checks, client download, Vault
# install, install dir and PATH warning, error paths and version pins.

load helpers/install_setup

CLIENT_URL="https://github.com/darthjee/kerghan/releases/download/0.5.0/kerghan"
VAULT_URL="https://raw.githubusercontent.com/darthjee/vault/0.1.0/install.sh"

@test "installs the stamped client version on Linux" {
  with_vault
  run_installer
  [ "$status" -eq 0 ]
  [ -x "$DEFAULT_DIR/kerghan" ]
  [ "$("$DEFAULT_DIR/kerghan")" = "fake kerghan 0.5.0" ]
  grep -q "^curl -fsSL -o $TMPDIR/.*/kerghan $CLIENT_URL\$" "$STUB_LOG"
  assert_output_contains "kerghan 0.5.0 installed to $DEFAULT_DIR/kerghan"
  assert_staging_cleaned
}

@test "installs on macOS" {
  with_vault
  export STUB_UNAME=Darwin
  run_installer
  [ "$status" -eq 0 ]
  [ -x "$DEFAULT_DIR/kerghan" ]
  grep -q " $CLIENT_URL\$" "$STUB_LOG"
}

@test "an unsupported OS exits 1" {
  export STUB_UNAME=FreeBSD
  run_installer
  [ "$status" -eq 1 ]
  assert_output_contains "error: unsupported OS: FreeBSD"
  assert_no_install
  refute_logged_prefix "curl "
}

@test "docker missing from PATH exits 1" {
  without_docker
  run_installer
  [ "$status" -eq 1 ]
  assert_output_contains "error: docker not found in PATH"
  assert_no_install
  refute_logged_prefix "curl "
}

@test "an unreachable Docker daemon exits 1 with a hint" {
  export STUB_DOCKER_INFO_EXIT=1
  run_installer
  [ "$status" -eq 1 ]
  assert_output_contains "error: cannot reach the Docker daemon"
  assert_output_contains "hint: "
  assert_no_install
  refute_logged_prefix "curl "
}

@test "an install dir that cannot be created exits 1" {
  : >"$TEST_ROOT/a-file"
  export KERGHAN_INSTALL_DIR="$TEST_ROOT/a-file/bin"
  run_installer
  [ "$status" -eq 1 ]
  assert_output_contains "error: $KERGHAN_INSTALL_DIR is not writable"
  assert_no_install "$KERGHAN_INSTALL_DIR"
  refute_logged_prefix "curl "
}

@test "a read-only install dir exits 1" {
  if [ "$(id -u)" = "0" ]; then
    skip "root can write to any directory"
  fi
  export KERGHAN_INSTALL_DIR="$TEST_ROOT/read-only"
  mkdir -p "$KERGHAN_INSTALL_DIR"
  chmod 555 "$KERGHAN_INSTALL_DIR"
  run_installer
  [ "$status" -eq 1 ]
  assert_output_contains "error: $KERGHAN_INSTALL_DIR is not writable"
  assert_no_install "$KERGHAN_INSTALL_DIR"
}

@test "a failed client download exits 1" {
  export STUB_CURL_FAIL_URL="/releases/download/"
  run_installer
  [ "$status" -eq 1 ]
  assert_output_contains "error: failed to download kerghan 0.5.0 from $CLIENT_URL"
  assert_no_install
}

@test "a failed Vault installer download exits 1" {
  export STUB_CURL_FAIL_URL="raw.githubusercontent.com"
  run_installer
  [ "$status" -eq 1 ]
  assert_output_contains "error: failed to download the Vault installer from $VAULT_URL"
  assert_no_install
  refute_logged_prefix "vault-install"
}

@test "a failing Vault installer exits 1" {
  export STUB_VAULT_INSTALL_EXIT=3
  run_installer
  [ "$status" -eq 1 ]
  assert_output_contains "error: the Vault installer failed"
  assert_logged "vault-install VAULT_VERSION=0.1.0"
  assert_no_install
}

@test "a missing vault is installed with the pinned Vault version" {
  run_installer
  [ "$status" -eq 0 ]
  grep -q "^curl -fsSL -o .* $VAULT_URL\$" "$STUB_LOG"
  assert_logged "vault-install VAULT_VERSION=0.1.0"
  [ -x "$DEFAULT_DIR/vault" ]
  [ -x "$DEFAULT_DIR/kerghan" ]
}

@test "an existing vault is left alone" {
  with_vault
  run_installer
  [ "$status" -eq 0 ]
  ! grep -q "raw.githubusercontent.com" "$STUB_LOG"
  refute_logged_prefix "vault-install"
  [ ! -e "$DEFAULT_DIR/vault" ]
}

@test "KERGHAN_INSTALL_DIR installs there" {
  with_vault
  export KERGHAN_INSTALL_DIR="$TEST_ROOT/custom/bin"
  run_installer
  [ "$status" -eq 0 ]
  [ -x "$KERGHAN_INSTALL_DIR/kerghan" ]
  [ ! -e "$DEFAULT_DIR/kerghan" ]
  assert_output_contains "kerghan 0.5.0 installed to $KERGHAN_INSTALL_DIR/kerghan"
}

@test "warns with the export line when the install dir is not on PATH" {
  with_vault
  run_installer
  [ "$status" -eq 0 ]
  assert_output_contains "warning: $DEFAULT_DIR is not on your PATH"
  assert_output_contains "export PATH=\"$DEFAULT_DIR:\$PATH\""
}

@test "does not warn when the install dir is on PATH" {
  with_vault
  INSTALL_PATH="$INSTALL_PATH:$DEFAULT_DIR"
  run_installer
  [ "$status" -eq 0 ]
  refute_output_contains "is not on your PATH"
  refute_output_contains "export PATH="
}

@test "a rerun upgrades the client in place" {
  with_vault
  mkdir -p "$DEFAULT_DIR"
  printf '#!/usr/bin/env bash\necho "old kerghan"\n' >"$DEFAULT_DIR/kerghan"
  chmod +x "$DEFAULT_DIR/kerghan"
  run_installer
  [ "$status" -eq 0 ]
  [ "$("$DEFAULT_DIR/kerghan")" = "fake kerghan 0.5.0" ]
}

@test "KERGHAN_VERSION installs that release" {
  with_vault
  export KERGHAN_VERSION=0.4.0
  run_installer
  [ "$status" -eq 0 ]
  grep -q " https://github.com/darthjee/kerghan/releases/download/0.4.0/kerghan\$" "$STUB_LOG"
  [ "$("$DEFAULT_DIR/kerghan")" = "fake kerghan 0.4.0" ]
  assert_output_contains "kerghan 0.4.0 installed to $DEFAULT_DIR/kerghan"
}

@test "never creates ~/.kerghan" {
  run_installer
  [ "$status" -eq 0 ]
  [ ! -e "$HOME/.kerghan" ]
}

@test "the stamped KERGHAN_VERSION matches the client's" {
  local installer_version client_version
  installer_version="$(stamped KERGHAN_VERSION "$INSTALLER")"
  client_version="$(stamped KERGHAN_VERSION "$KERGHAN_CLIENT")"
  [ -n "$installer_version" ]
  [ "$installer_version" = "$client_version" ]
}

@test "VAULT_VERSION matches the standalone image's darthjee/vault tag" {
  if [ ! -f "$STANDALONE_DOCKERFILE" ]; then
    skip "dockerfiles/ is not available (only standalone/ is mounted)"
  fi
  local pinned image_tag
  pinned="$(stamped VAULT_VERSION "$INSTALLER")"
  image_tag="$(sed -n 's/^FROM darthjee\/vault:\([0-9.]*\) .*$/\1/p' "$STANDALONE_DOCKERFILE")"
  [ -n "$pinned" ]
  [ "$pinned" = "$image_tag" ]
}
