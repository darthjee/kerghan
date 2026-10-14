#!/usr/bin/env bash
# install.sh - installer for the kerghan client of the Kerghan standalone
# distribution (darthjee/kerghan-standalone).
#
# Usage:
#   curl -fsSL https://github.com/darthjee/kerghan/releases/latest/download/install.sh | bash
#
# Variables:
#   KERGHAN_VERSION      client version to install (default: the version this
#                        installer was released with)
#   KERGHAN_INSTALL_DIR  where the kerghan client goes (default: ~/.local/bin)
#
# It downloads the kerghan client of the chosen version into the install dir
# (a rerun upgrades it in place) and installs the `vault` CLI when it is not
# on PATH yet. It never uses sudo and never touches ~/.kerghan or any Docker
# volume.
#
# To verify the installer before running it, download it together with
# SHA256SUMS from the same release and check it first:
#   curl -fsSLO https://github.com/darthjee/kerghan/releases/download/<version>/install.sh
#   curl -fsSLO https://github.com/darthjee/kerghan/releases/download/<version>/SHA256SUMS
#   sha256sum -c --ignore-missing SHA256SUMS          # Linux
#   shasum -a 256 -c --ignore-missing SHA256SUMS      # macOS
#   bash install.sh
#
# Self-contained (it sources nothing) and bash 3.2 compatible (macOS). All
# work runs from main, called on the last line, so a truncated download runs
# nothing.
set -euo pipefail

# The user's override is read before the stamp line below, which
# scripts/bump_version.sh rewrites on every release.
requested_version="${KERGHAN_VERSION:-}"
KERGHAN_VERSION="0.8.0"
version="${requested_version:-$KERGHAN_VERSION}"

# Not overridable: it must match `FROM darthjee/vault:<v>` in
# dockerfiles/kerghan_standalone/Dockerfile.
VAULT_VERSION="0.1.0"

install_dir="${KERGHAN_INSTALL_DIR:-$HOME/.local/bin}"
client_url="https://github.com/darthjee/kerghan/releases/download/$version/kerghan"
vault_installer_url="https://raw.githubusercontent.com/darthjee/vault/$VAULT_VERSION/install.sh"
staging=""

error() { echo "kerghan-install: error: $*" >&2; }
warn() { echo "kerghan-install: warning: $*" >&2; }
hint() { echo "kerghan-install: hint: $*" >&2; }
info() { echo "kerghan-install: $*"; }

check_os() {
  local os
  os="$(uname -s)"
  case "$os" in
    Linux | Darwin) ;;
    *)
      error "unsupported OS: $os"
      exit 1
      ;;
  esac
}

check_docker() {
  if ! command -v docker >/dev/null 2>&1; then
    error "docker not found in PATH"
    hint "install Docker (https://docs.docker.com/get-docker/) and run this installer again"
    exit 1
  fi
  if ! docker info >/dev/null 2>&1; then
    error "cannot reach the Docker daemon"
    hint "start Docker (or check that your user may access it) and run this installer again"
    exit 1
  fi
}

check_dir() {
  if ! mkdir -p "$install_dir" 2>/dev/null || [ ! -d "$install_dir" ] || [ ! -w "$install_dir" ]; then
    error "$install_dir is not writable"
    hint "set KERGHAN_INSTALL_DIR to a writable directory"
    exit 1
  fi
}

cleanup() {
  if [ -n "$staging" ]; then
    rm -rf "$staging"
  fi
}

fetch_client() {
  info "downloading kerghan $version"
  if ! curl -fsSL -o "$staging/kerghan" "$client_url"; then
    error "failed to download kerghan $version from $client_url"
    exit 1
  fi
  chmod +x "$staging/kerghan"
}

ensure_vault() {
  if command -v vault >/dev/null 2>&1; then
    return 0
  fi
  info "vault not found in PATH, installing Vault $VAULT_VERSION"
  # Downloaded to a file, never piped into bash, so a failed download is
  # detected.
  if ! curl -fsSL -o "$staging/vault-install.sh" "$vault_installer_url"; then
    error "failed to download the Vault installer from $vault_installer_url"
    exit 1
  fi
  if ! VAULT_VERSION="$VAULT_VERSION" bash "$staging/vault-install.sh"; then
    error "the Vault installer failed"
    exit 1
  fi
}

move_client() {
  # The only write to the install dir: a failure before it leaves no partial
  # install, and -f lets a rerun upgrade in place.
  mv -f "$staging/kerghan" "$install_dir/kerghan"
}

check_path() {
  case ":$PATH:" in
    *":$install_dir:"*) ;;
    *)
      warn "$install_dir is not on your PATH"
      hint "add it to your shell profile with:"
      echo "  export PATH=\"$install_dir:\$PATH\"" >&2
      ;;
  esac
}

main() {
  check_os
  check_docker
  check_dir
  staging="$(mktemp -d)"
  trap cleanup EXIT
  fetch_client
  ensure_vault
  move_client
  info "kerghan $version installed to $install_dir/kerghan"
  check_path
}

main "$@"
