#!/bin/bash

# Publishes the kerghan client release assets to the GitHub release of
# <CIRCLE_TAG> on darthjee/kerghan:
#
#   kerghan          standalone/bin/kerghan
#   install.sh       standalone/install.sh
#   config.example   standalone/config.example
#   SHA256SUMS       sha256sum of the three files above (bare basenames, so
#                    `sha256sum -c SHA256SUMS` works next to the downloads)
#
# The release is created when it does not exist yet; assets are uploaded with
# --clobber so a re-run replaces them. `gh` reads GITHUB_TOKEN directly.

set -euo pipefail

REPO=darthjee/kerghan
CLI=standalone/bin/kerghan
INSTALLER=standalone/install.sh
CONFIG_EXAMPLE=standalone/config.example
ASSETS="kerghan install.sh config.example"

function require_tag() {
  if [ -z "${CIRCLE_TAG:-}" ]; then
    echo "CIRCLE_TAG is empty: release assets are only published on tag builds." >&2
    exit 1
  fi

  if [ -z "${GITHUB_TOKEN:-}" ]; then
    echo "GITHUB_TOKEN is empty: set it as a CircleCI project variable" \
      "(a token with contents: write on $REPO)." >&2
    exit 1
  fi
}

# Prints the KERGHAN_VERSION="..." value stamped in <file>.
function pinned_version() {
  local file=$1

  grep -E '^KERGHAN_VERSION="[0-9.]*"$' "$file" \
    | head -n 1 \
    | sed -E 's/^KERGHAN_VERSION="([0-9.]*)"$/\1/'
}

# Fails unless both the client and the installer pin CIRCLE_TAG, so a release
# never ships a client that runs another image version.
function check_pins() {
  local file
  local pinned

  for file in "$CLI" "$INSTALLER"; do
    if [ ! -f "$file" ]; then
      echo "$file is missing." >&2
      exit 1
    fi

    pinned=$(pinned_version "$file")
    if [ "$pinned" != "$CIRCLE_TAG" ]; then
      echo "$file pins KERGHAN_VERSION=\"$pinned\", expected \"$CIRCLE_TAG\"." >&2
      exit 1
    fi
  done
}

# Copies the assets into <dir> under their release basenames and writes
# SHA256SUMS there.
function stage() {
  local dir=$1

  cp "$CLI" "$dir/kerghan"
  cp "$INSTALLER" "$dir/install.sh"
  cp "$CONFIG_EXAMPLE" "$dir/config.example"

  (
    cd "$dir"
    # shellcheck disable=SC2086
    sha256sum $ASSETS > SHA256SUMS
    sha256sum -c SHA256SUMS
  )
}

# Creates the release for CIRCLE_TAG unless it already exists. A release
# created concurrently (e.g. manually) between the view and the create is fine.
function ensure_release() {
  local output

  if gh release view "$CIRCLE_TAG" --repo "$REPO" > /dev/null 2>&1; then
    return
  fi

  if ! output=$(gh release create "$CIRCLE_TAG" \
    --repo "$REPO" \
    --verify-tag \
    --title "$CIRCLE_TAG" \
    --notes "kerghan $CIRCLE_TAG" 2>&1); then
    if echo "$output" | grep -qi "already exists"; then
      echo "Release $CIRCLE_TAG already exists, continuing."
      return
    fi

    echo "$output" >&2
    exit 1
  fi

  if [ -n "$output" ]; then
    echo "$output"
  fi
}

function upload() {
  local dir=$1

  (
    cd "$dir"
    # shellcheck disable=SC2086
    gh release upload "$CIRCLE_TAG" $ASSETS SHA256SUMS \
      --repo "$REPO" \
      --clobber
  )
}

function release() {
  require_tag
  check_pins

  local dir
  dir=$(mktemp -d)
  # shellcheck disable=SC2064
  trap "rm -rf '$dir'" EXIT

  stage "$dir"
  ensure_release
  upload "$dir"
}

ACTION=${1:-}

case $ACTION in
  "release") release ;;
  *)
    echo "Usage: $0 release"
    exit 1
    ;;
esac
