#!/usr/bin/env bash
# Bumps the Vault version pinned across the standalone distribution.
# Usage: scripts/bump_vault.sh <X.Y.Z>

set -euo pipefail

if [ $# -ne 1 ]; then
  echo "Usage: $0 <X.Y.Z>" >&2
  exit 1
fi

new_version="$1"

if ! echo "$new_version" | grep -qE '^[0-9]+\.[0-9]+\.[0-9]+$'; then
  echo "Error: version must be in X.Y.Z format" >&2
  exit 1
fi

ROOT="$(git rev-parse --show-toplevel)"
V='[0-9][0-9]*\.[0-9][0-9]*\.[0-9][0-9]*'

# replace <file> <sed-expression>: edits in place when the file exists
replace() {
  if [ -f "$1" ]; then
    sed -i '' "$2" "$1"
  else
    echo "Warning: $1 not found, skipped" >&2
  fi
}

echo "Vault version: $new_version"

# Base image of the standalone image
replace "$ROOT/dockerfiles/kerghan_standalone/Dockerfile" \
  "s|^FROM darthjee/vault:${V}|FROM darthjee/vault:${new_version}|"

# Vault CLI version the installer downloads (must match the image tag)
replace "$ROOT/standalone/install.sh" \
  "s|^VAULT_VERSION=\"${V}\"|VAULT_VERSION=\"${new_version}\"|"

# Probe image default of the client-IP verification script
replace "$ROOT/standalone/scripts/verify_client_ip.sh" \
  "s|darthjee/vault:${V}|darthjee/vault:${new_version}|g"

# Installer tests
replace "$ROOT/standalone/test/install.bats" \
  "s|darthjee/vault/${V}/|darthjee/vault/${new_version}/|; s|VAULT_VERSION=${V}|VAULT_VERSION=${new_version}|g"

# Docs
replace "$ROOT/docs/agents/external/vault.md" \
  "s|^\*\*Vault version:\*\* ${V}|**Vault version:** ${new_version}|"
replace "$ROOT/docs/agents/standalone/inner-stack.md" \
  "s|darthjee/vault:${V}|darthjee/vault:${new_version}|g"
replace "$ROOT/docs/agents/standalone/install.md" \
  "s|VAULT_VERSION=\"${V}\"|VAULT_VERSION=\"${new_version}\"|; s|darthjee/vault:${V}|darthjee/vault:${new_version}|g"
replace "$ROOT/docs/agents/standalone/release-and-caveats.md" \
  "s#^\(| \`darthjee/vault\` (base) | \`\)${V}#\1${new_version}#"

echo "Done."
