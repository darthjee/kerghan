#!/usr/bin/env bats
# scripts/bump_tent.sh: writes the Tent pin to `version` and syncs / checks every copy.

bats_require_minimum_version 1.5.0
# Reuses teardown (removes TEST_ROOT) and assert_output_contains.
load helpers/setup

BUMP="$BATS_TEST_DIRNAME/../bump_tent.sh"

setup() {
  TEST_ROOT="$(mktemp -d "$BATS_TMPDIR/bump-tent-test.XXXXXX")"
  export ROOT="$TEST_ROOT/repo"
  write_tree "$ROOT" 9.1.0
}

# write_tree <dir> <version> [stale] - a fixture repository whose synced copies pin
# <version> (<stale> instead in the agent definitions, when given). The `latest`
# and suffixed tags and security.md never change with <version>.
write_tree() {
  local dir=$1
  local v=$2
  local agents=${3:-$2}

  mkdir -p "$dir/.circleci" "$dir/.claude/agents" "$dir/docs/agents/architecture/infra"

  printf '%s\n' "kerghan-base=0.1.2" "tent=$v" >"$dir/version"

  cat >"$dir/docker-compose.yml" <<EOF
services:
  kerghan_proxy:
    image: darthjee/tent:$v
  proxy_tests:
    image: darthjee/tent-test:$v
  proxy_lint:
    image: darthjee/tent-test:$v
  other:
    image: darthjee/tent:latest
  legacy:
    image: darthjee/tent:9.9.9-arm64
EOF

  cat >"$dir/.circleci/config.yml" <<EOF
jobs:
  proxy_extension_tests:
    docker:
      - image: darthjee/tent-test:$v
  upload_proxy_files:
    docker:
      - image: darthjee/tent:$v
  untouched:
    docker:
      - image: darthjee/tent-test:latest
EOF

  cat >"$dir/docs/agents/architecture/infra/ci-jobs.md" <<EOF
| Job | Image |
|-----|-------|
| \`proxy_extension_tests\` | \`darthjee/tent-test:$v\` |
| \`upload_proxy_files\` | \`darthjee/tent:$v\` |
| both | \`darthjee/tent:$v\` and \`darthjee/tent-test:$v\` |
EOF

  cat >"$dir/.claude/agents/proxy.md" <<EOF
docker run --rm darthjee/tent:$agents sh -c 'php -l file.php'
two on one line: darthjee/tent:$agents darthjee/tent-test:$agents
image \`darthjee/tent-test:$agents\`, at end of line: darthjee/tent:$agents
a legacy \`darthjee/tent:9.9.9-arm64\` tag
EOF

  cat >"$dir/.claude/agents/infra.md" <<EOF
| \`kerghan_proxy\` | \`darthjee/tent:$agents\` | 3000 |
| \`proxy_lint\` | \`darthjee/tent-test:$agents\` | - |
EOF

  cat >"$dir/docs/agents/architecture/security.md" <<EOF
Verified in the \`darthjee/tent:9.1.0\` image; recheck on a Tent upgrade.
EOF
}

# snapshot - keeps a copy of the fixture tree for assert_unchanged.
snapshot() {
  cp -R "$ROOT" "$TEST_ROOT/snapshot"
}

assert_unchanged() {
  diff -r "$TEST_ROOT/snapshot" "$ROOT"
}

# drift <file> <sed-expression> - edits a copy by hand, bypassing the script.
drift() {
  sed -e "$2" "$ROOT/$1" >"$TEST_ROOT/edit"
  cat "$TEST_ROOT/edit" >"$ROOT/$1"
}

@test "bump writes tent= and rewrites every tent and tent-test copy, nothing else" {
  rm -rf "$ROOT"
  write_tree "$ROOT" 9.1.0 8.10.1
  write_tree "$TEST_ROOT/expected" 9.4.0
  run bash "$BUMP" 9.4.0
  [ "$status" -eq 0 ]
  diff -r "$TEST_ROOT/expected" "$ROOT"
  grep -qx 'tent=9.4.0' "$ROOT/version"
}

@test "bump leaves latest, suffixed tags and security.md untouched" {
  run bash "$BUMP" 9.4.0
  [ "$status" -eq 0 ]
  grep -qF 'image: darthjee/tent:latest' "$ROOT/docker-compose.yml"
  grep -qF 'image: darthjee/tent:9.9.9-arm64' "$ROOT/docker-compose.yml"
  grep -qF 'image: darthjee/tent-test:latest' "$ROOT/.circleci/config.yml"
  grep -qF 'darthjee/tent:9.9.9-arm64' "$ROOT/.claude/agents/proxy.md"
  grep -qF 'darthjee/tent:9.1.0' "$ROOT/docs/agents/architecture/security.md"
}

@test "bumping to the pinned version is idempotent" {
  snapshot
  run bash "$BUMP" 9.1.0
  [ "$status" -eq 0 ]
  assert_unchanged
}

@test "downgrades are accepted" {
  write_tree "$TEST_ROOT/expected" 9.0.2
  run bash "$BUMP" 9.0.2
  [ "$status" -eq 0 ]
  diff -r "$TEST_ROOT/expected" "$ROOT"
}

@test "bump keeps the file mode and leaves no temp file" {
  chmod 755 "$ROOT/docker-compose.yml"
  run bash "$BUMP" 9.4.0
  [ "$status" -eq 0 ]
  [ -x "$ROOT/docker-compose.yml" ]
  [ -z "$(find "$ROOT" -name '*.tmp')" ]
}

@test "no argument is refused with a format error, touching nothing" {
  snapshot
  run bash "$BUMP"
  [ "$status" -ne 0 ]
  assert_output_contains "version must be in X.Y.Z format"
  assert_unchanged
}

@test "an empty argument is refused with a format error, touching nothing" {
  snapshot
  run bash "$BUMP" ""
  [ "$status" -ne 0 ]
  assert_output_contains "version must be in X.Y.Z format"
  assert_unchanged
}

@test "a malformed version is refused with a format error, touching nothing" {
  snapshot
  for bad in 9.4 v9.4.0 9.4.0-arm64 9.4.0.1 latest $'9.4.0\nlatest'; do
    run bash "$BUMP" "$bad"
    [ "$status" -ne 0 ]
    assert_output_contains "version must be in X.Y.Z format"
  done
  assert_unchanged
}

@test "two arguments are refused, touching nothing" {
  snapshot
  run bash "$BUMP" 9.4.0 9.5.0
  [ "$status" -ne 0 ]
  assert_unchanged
}

@test "bump fails on a version file without a tent= line, touching nothing" {
  printf 'kerghan-base=0.1.2\n' >"$ROOT/version"
  snapshot
  run bash "$BUMP" 9.4.0
  [ "$status" -ne 0 ]
  assert_output_contains "version file has no tent= entry"
  assert_unchanged
}

@test "bump fails on a missing listed file, touching nothing" {
  rm "$ROOT/.claude/agents/infra.md"
  snapshot
  run bash "$BUMP" 9.4.0
  [ "$status" -ne 0 ]
  assert_output_contains ".claude/agents/infra.md not found"
  assert_unchanged
}

@test "--check passes on a consistent tree and rewrites nothing" {
  snapshot
  run bash "$BUMP" --check
  [ "$status" -eq 0 ]
  assert_output_contains "Every Tent copy matches tent=9.1.0."
  assert_unchanged
}

@test "--check passes after a bump" {
  run bash "$BUMP" 9.4.0
  [ "$status" -eq 0 ]
  run bash "$BUMP" --check
  [ "$status" -eq 0 ]
}

@test "--check names the file and line of a drifted copy, rewriting nothing" {
  drift docker-compose.yml 's|tent-test:9.1.0|tent-test:9.4.0|'
  snapshot
  run bash "$BUMP" --check
  [ "$status" -eq 1 ]
  assert_output_contains "docker-compose.yml:5: darthjee/tent-test:9.4.0 differs from tent=9.1.0"
  assert_output_contains "docker-compose.yml:7: darthjee/tent-test:9.4.0 differs from tent=9.1.0"
  assert_unchanged
}

@test "--check lists every drifted copy, including two on one line" {
  printf '%s\n' "tent=9.4.0" >"$ROOT/version"
  run bash "$BUMP" --check
  [ "$status" -eq 1 ]
  assert_output_contains ".circleci/config.yml:4: darthjee/tent-test:9.1.0"
  assert_output_contains "docs/agents/architecture/infra/ci-jobs.md:5: darthjee/tent:9.1.0"
  assert_output_contains "docs/agents/architecture/infra/ci-jobs.md:5: darthjee/tent-test:9.1.0"
  assert_output_contains ".claude/agents/proxy.md:3: darthjee/tent:9.1.0"
  assert_output_contains ".claude/agents/infra.md:2: darthjee/tent-test:9.1.0"
  [[ "$output" != *"security.md"* ]]
  [[ "$output" != *"arm64"* ]]
}

@test "--check fails on a version file without a tent= line" {
  printf 'kerghan-base=0.1.2\n' >"$ROOT/version"
  run bash "$BUMP" --check
  [ "$status" -ne 0 ]
  assert_output_contains "version file has no tent= entry"
}

@test "--check fails on an empty tent= entry" {
  printf 'tent=\n' >"$ROOT/version"
  run bash "$BUMP" --check
  [ "$status" -ne 0 ]
  assert_output_contains "tent= entry must be in X.Y.Z format"
}

@test "--check fails on a missing listed file" {
  rm "$ROOT/docker-compose.yml"
  run bash "$BUMP" --check
  [ "$status" -ne 0 ]
  assert_output_contains "docker-compose.yml not found"
}
