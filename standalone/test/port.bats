#!/usr/bin/env bats
# A failing vault up keeps Vault's error, hints at -p on a port conflict and
# propagates the exit code.

load helpers/setup

@test "a port conflict shows Vault's error, the -p hint and Vault's exit code" {
  write_env_file
  export STUB_VAULT_UP_EXIT=3
  export STUB_VAULT_UP_STDERR="Error: Bind for 0.0.0.0:3000 failed: port is already allocated"
  run "$KERGHAN" up
  [ "$status" -eq 3 ]
  assert_output_contains "port is already allocated"
  assert_output_contains "kerghan: hint: use 'kerghan up -p <port>' to pick another port"
  [[ "$output" != *"Kerghan is running"* ]]
}

@test "Vault's own 'choose another host port' hint also triggers the -p hint" {
  write_env_file
  export STUB_VAULT_UP_EXIT=1
  export STUB_VAULT_UP_STDERR="vault: hint: choose another host port with -p"
  run "$KERGHAN" up
  [ "$status" -eq 1 ]
  assert_output_contains "kerghan: hint: use 'kerghan up -p <port>'"
}

@test "another vault failure propagates without the -p hint" {
  write_env_file
  export STUB_VAULT_UP_EXIT=1
  export STUB_VAULT_UP_STDERR="vault: error: sysbox runtime not found"
  run "$KERGHAN" up
  [ "$status" -eq 1 ]
  assert_output_contains "sysbox runtime not found"
  [[ "$output" != *"kerghan up -p"* ]]
}
