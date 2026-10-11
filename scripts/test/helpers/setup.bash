# Shared harness for the Render deploy script tests: curl, sleep and git stubs
# first on PATH and STUB_LOG assertions.
# shellcheck disable=SC2034,SC2154 # DEPLOY is used and $output set by the .bats files

DEPLOY="$BATS_TEST_DIRNAME/../deploy.sh"

setup() {
  TEST_ROOT="$(mktemp -d "$BATS_TMPDIR/deploy-test.XXXXXX")"
  STUB_BIN="$TEST_ROOT/bin"
  mkdir -p "$STUB_BIN"
  cp "$BATS_TEST_DIRNAME/stubs/curl" "$BATS_TEST_DIRNAME/stubs/sleep" \
    "$BATS_TEST_DIRNAME/stubs/git" "$STUB_BIN/"
  chmod +x "$STUB_BIN"/*
  export PATH="$STUB_BIN:$PATH"
  export STUB_LOG="$TEST_ROOT/stub.log"
  : >"$STUB_LOG"
  export RENDER_API_KEY="test-key"
  unset CIRCLE_TAG RENDER_SERVICE_NAME RENDER_DOCKERFILE STUB_PATCH_FAIL \
    STUB_DEPLOY_FAIL STUB_DEPLOY_RESPONSE STUB_DEPLOY_STATUSES STUB_GIT_TAGS STUB_GIT_DESCRIBE
  export RENDER_DOCKERFILE="$TEST_ROOT/Dockerfile"
}

teardown() {
  rm -rf "$TEST_ROOT"
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

# write_dockerfile [tag] - writes the thin Render Dockerfile used by the test
# as `FROM darthjee/kerghan:<tag>` (default 1.2.3, the tag under test).
write_dockerfile() {
  printf '# thin Render Dockerfile\nFROM darthjee/kerghan:%s\n' "${1:-1.2.3}" >"$RENDER_DOCKERFILE"
}

# branch_patch <tag> - the expected request moving the service branch to <tag>.
branch_patch() {
  echo "curl PATCH https://api.render.com/v1/services/srv-123 {\"branch\":\"$1\"}"
}

# deploy_post - the expected plain deploy request (no body).
deploy_post() {
  echo "curl POST https://api.render.com/v1/services/srv-123/deploys "
}
