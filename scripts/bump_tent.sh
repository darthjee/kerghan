#!/usr/bin/env bash
# Owns the Tent pin. The single source of truth is the `tent=X.Y.Z` line of the
# root `version` file, covering both darthjee/tent and darthjee/tent-test. Files
# that cannot read it hold synced copies, rewritten and verified here.
#
# Usage: scripts/bump_tent.sh <X.Y.Z>  write tent=<X.Y.Z> to `version`, then sync every copy
#        scripts/bump_tent.sh --check  exit non-zero, listing each copy that differs from `version`
#
# ROOT overrides the repository root (used by the bats suite).

set -euo pipefail

# Synced copies, relative to the repository root.
# docs/agents/architecture/security.md is deliberately absent: its pin names the
# version the security recheck ran against, so it only moves by hand.
FILES=(
  docker-compose.yml
  .circleci/config.yml
  docs/agents/architecture/infra/ci-jobs.md
  .claude/agents/proxy.md
  .claude/agents/infra.md
)

VERSION_RE='^[0-9]+\.[0-9]+\.[0-9]+$'
# A synced copy (extended regex): a versioned tent / tent-test tag followed by end
# of line, whitespace or a backtick. Suffixed tags and `latest` never match.
PIN='(darthjee/tent(-test)?:)[0-9]+\.[0-9]+\.[0-9]+'
PIN_END='([[:space:]`]|$)'

usage() {
  echo "Usage: $0 <X.Y.Z> | --check" >&2
}

format_error() {
  echo "Error: version must be in X.Y.Z format" >&2
  usage
  exit 1
}

# Fails, before anything is read or written, on a missing file or tent= line.
require_files() {
  local file

  for file in version "${FILES[@]}"; do
    if [ ! -f "$ROOT/$file" ]; then
      echo "Error: $file not found under $ROOT" >&2
      exit 1
    fi
  done

  if ! grep -q '^tent=' "$ROOT/version"; then
    echo "Error: the version file has no tent= entry" >&2
    exit 1
  fi
}

# replace <file> <sed-expression>: in-place edit through a temp file and mv (BSD
# and BusyBox sed disagree on -i), keeping the file's mode.
replace() {
  local file=$1
  local expression=$2
  local tmp="$file.bump_tent.tmp"

  cp -p "$file" "$tmp"
  sed -E "$expression" "$file" >"$tmp"
  mv "$tmp" "$file"
}

bump() {
  local version=$1
  local file

  require_files
  echo "Tent version: $version"

  replace "$ROOT/version" "s#^tent=.*#tent=$version#"
  for file in "${FILES[@]}"; do
    replace "$ROOT/$file" "s#$PIN$PIN_END#\\1$version\\3#g"
  done

  echo "Done."
}

check() {
  local version
  local file
  local hits
  local hit
  local image
  local found
  local drift=0

  require_files
  version=$(grep '^tent=' "$ROOT/version" | sed -e 's/^tent=//')

  if ! [[ "$version" =~ $VERSION_RE ]]; then
    echo "Error: the version file's tent= entry must be in X.Y.Z format," \
      "got '$version'" >&2
    exit 1
  fi

  for file in "${FILES[@]}"; do
    # One "<line>:<match>" per copy.
    hits=$(grep -noE "$PIN$PIN_END" "$ROOT/$file" || true)

    while IFS= read -r hit; do
      [ -n "$hit" ] || continue
      image=${hit#*:}
      image=${image%:*}
      found=${hit##*:}
      found=${found%%[!0-9.]*}

      if [ "$found" != "$version" ]; then
        echo "$file:${hit%%:*}: $image:$found differs from tent=$version" >&2
        drift=1
      fi
    done <<<"$hits"
  done

  if [ "$drift" -ne 0 ]; then
    echo "Run scripts/bump_tent.sh $version to sync the copies." >&2
    exit 1
  fi

  echo "Every Tent copy matches tent=$version."
}

[ $# -eq 1 ] || format_error

if [ "$1" != "--check" ] && ! [[ "$1" =~ $VERSION_RE ]]; then
  format_error
fi

ROOT="${ROOT:-$(git rev-parse --show-toplevel)}"

case "$1" in
  --check) check ;;
  *) bump "$1" ;;
esac
