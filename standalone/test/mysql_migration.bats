#!/usr/bin/env bats
# MySQL 9.3 -> 8.4.11 data migration (#469): detection, the order of the steps,
# the verification before the old volume is deleted, failures and retries.

load helpers/setup

PW="s3cretpw-do-not-log"

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
  export KERGHAN_MIGRATE_TIMEOUT=0
  export KERGHAN_MYSQL_PASSWORD="$PW"
  unset STUB_VOLUME_EXISTS STUB_RUNNING_IMAGE STUB_LEGACY_VOLUME STUB_LEGACY_EMPTY \
    STUB_LEGACY_RM_EXIT STUB_MIG_FAIL
  ENV_FILE="$HOME/.kerghan/kerghan.env"
  write_env_file
}

# line_no <pattern> - number of the first STUB_LOG line matching the fixed text.
line_no() {
  grep -nF -- "$1" "$STUB_LOG" | head -n 1 | cut -d: -f1
}

# assert_log_order <text>... - each text is logged after the previous one.
assert_log_order() {
  local prev=0 n text
  for text in "$@"; do
    n="$(line_no "$text")"
    if [ -z "$n" ] || [ "$n" -le "$prev" ]; then
      echo "expected '$text' after line $prev (found: ${n:-none})" >&2
      cat "$STUB_LOG" >&2
      return 1
    fi
    prev="$n"
  done
}

refute_volume_removed() {
  refute_logged_prefix "docker exec vault-kerghan docker volume rm"
}

@test "a fresh install makes no migration calls and never starts mysql-legacy" {
  run "$KERGHAN" up
  [ "$status" -eq 0 ]
  [[ "$output" != *migrat* ]]
  ! grep -q "mysql-legacy" "$STUB_LOG"
  refute_volume_removed
}

@test "an empty old volume is not a migration" {
  export STUB_LEGACY_VOLUME=1 STUB_LEGACY_EMPTY=1
  run "$KERGHAN" up
  [ "$status" -eq 0 ]
  ! grep -q "mysql-legacy" "$STUB_LOG"
  refute_volume_removed
}

@test "old data is migrated in order and the old volume is removed last" {
  export STUB_LEGACY_VOLUME=1
  run "$KERGHAN" up
  [ "$status" -eq 0 ]
  assert_log_order \
    "vault compose --name kerghan stop kerghan" \
    "vault compose --name kerghan --profile migrate-mysql-9 up -d mysql-legacy" \
    "exec -T mysql-legacy sh -c" \
    "DROP DATABASE IF EXISTS kerghan; CREATE DATABASE kerghan" \
    "vault compose --name kerghan --profile migrate-mysql-9 rm -s -f mysql-legacy" \
    "vault compose --name kerghan start kerghan" \
    "docker exec vault-kerghan docker volume rm vault_mysql-data"
  grep -q "mysqldump -uroot --single-transaction --routines --triggers --databases kerghan" "$STUB_LOG"
  assert_output_contains "MySQL data migrated from 9.3 to 8.4.11; the old 9.3 data was removed"
}

@test "an already running instance still migrates on kerghan up" {
  export STUB_LEGACY_VOLUME=1 STUB_RUNNING_IMAGE="$IMAGE"
  run "$KERGHAN" up
  [ "$status" -eq 0 ]
  assert_output_contains "Kerghan is already running"
  assert_output_contains "MySQL data migrated from 9.3 to 8.4.11"
  assert_logged "docker exec vault-kerghan docker volume rm vault_mysql-data"
}

@test "a failure at each step exits 1, keeps the old volume and prints the error and hint" {
  local step
  for step in stop legacy_up legacy_health dump restore start health count; do
    : >"$STUB_LOG"
    export STUB_LEGACY_VOLUME=1 STUB_MIG_FAIL="$step"
    run "$KERGHAN" up
    if [ "$status" -ne 1 ]; then
      echo "step $step: status $status" >&2
      return 1
    fi
    refute_volume_removed
    assert_output_contains "kerghan: error: migrating the MySQL 9.3 data to 8.4.11 failed; the 9.3 data was kept"
    assert_output_contains "kerghan: hint: run 'kerghan up' again to retry the migration"
    [[ "$output" != *"the old 9.3 data was removed"* ]]
    # mysql-legacy is stopped on failure.
    assert_logged "vault compose --name kerghan --profile migrate-mysql-9 rm -s -f mysql-legacy"
  done
}

@test "a retry after a failure migrates and removes the old volume" {
  export STUB_LEGACY_VOLUME=1 STUB_MIG_FAIL=restore
  run "$KERGHAN" up
  [ "$status" -eq 1 ]
  refute_volume_removed
  unset STUB_MIG_FAIL
  : >"$STUB_LOG"
  run "$KERGHAN" up
  [ "$status" -eq 0 ]
  assert_output_contains "MySQL data migrated from 9.3 to 8.4.11"
  assert_logged "docker exec vault-kerghan docker volume rm vault_mysql-data"
}

@test "a failing volume removal fails the migration" {
  export STUB_LEGACY_VOLUME=1 STUB_LEGACY_RM_EXIT=1
  run "$KERGHAN" up
  [ "$status" -eq 1 ]
  assert_output_contains "kerghan: error: migrating the MySQL 9.3 data to 8.4.11 failed"
}

@test "the MySQL password never appears in a command line or in the output" {
  export STUB_LEGACY_VOLUME=1
  run "$KERGHAN" up
  [ "$status" -eq 0 ]
  ! grep -qF -- "$PW" "$STUB_LOG"
  [[ "$output" != *"$PW"* ]]
  grep -qF 'MYSQL_PWD="$MYSQL_ROOT_PASSWORD"' "$STUB_LOG"
}
