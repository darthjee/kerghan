#!/usr/bin/env bats
# The vault arguments built for each command, usage errors, version and help.

load helpers/setup

IMAGE="darthjee/kerghan-standalone:0.5.0"

@test "up runs vault up with the online image, the env file and port 3000" {
  write_env_file
  run "$KERGHAN" up
  [ "$status" -eq 0 ]
  assert_logged "vault up --name kerghan --image $IMAGE --env-file $ENV_FILE -p 3000:80 -e FRONTEND_BASE_URL=http://localhost:3000"
  assert_output_contains "Kerghan is running at http://localhost:3000"
}

@test "up --offline uses the offline image" {
  write_env_file
  run "$KERGHAN" up --offline
  [ "$status" -eq 0 ]
  assert_logged "vault up --name kerghan --image $IMAGE-offline --env-file $ENV_FILE -p 3000:80 -e FRONTEND_BASE_URL=http://localhost:3000"
}

@test "up -p 8080 publishes the custom port" {
  write_env_file
  run "$KERGHAN" up -p 8080
  [ "$status" -eq 0 ]
  assert_logged "vault up --name kerghan --image $IMAGE --env-file $ENV_FILE -p 8080:80 -e FRONTEND_BASE_URL=http://localhost:8080"
}

@test "up --port and --offline combine" {
  write_env_file
  run "$KERGHAN" up --offline --port 4000
  [ "$status" -eq 0 ]
  assert_logged "vault up --name kerghan --image $IMAGE-offline --env-file $ENV_FILE -p 4000:80 -e FRONTEND_BASE_URL=http://localhost:4000"
}

@test "up -f runs vault in the foreground" {
  write_env_file
  run "$KERGHAN" up -f
  [ "$status" -eq 0 ]
  assert_logged "vault up --name kerghan --image $IMAGE --env-file $ENV_FILE -p 3000:80 -e FRONTEND_BASE_URL=http://localhost:3000 -f"
}

@test "vault runs from ~/.kerghan, away from a stray .vaultrc" {
  write_env_file
  cd "$TEST_ROOT"
  echo "name=other" >.vaultrc
  run "$KERGHAN" up
  [ "$status" -eq 0 ]
  [ "$(cat "$STUB_LOG.pwd")" = "$HOME/.kerghan" ]
}

@test "down runs vault down" {
  run "$KERGHAN" down
  [ "$status" -eq 0 ]
  [ "$(vault_calls)" = "vault down --name kerghan" ]
}

@test "logs runs vault logs" {
  run "$KERGHAN" logs
  [ "$status" -eq 0 ]
  [ "$(vault_calls)" = "vault logs --name kerghan" ]
}

@test "logs -f follows the logs" {
  run "$KERGHAN" logs -f
  [ "$status" -eq 0 ]
  [ "$(vault_calls)" = "vault logs --name kerghan -f" ]
}

@test "status runs vault status" {
  run "$KERGHAN" status
  [ "$status" -eq 0 ]
  [ "$(vault_calls)" = "vault status --name kerghan" ]
}

@test "compose passes its arguments through" {
  run "$KERGHAN" compose exec mysql sh
  [ "$status" -eq 0 ]
  [ "$(vault_calls)" = "vault compose --name kerghan exec mysql sh" ]
}

@test "an unknown command prints the usage and exits 2" {
  run "$KERGHAN" frobnicate
  [ "$status" -eq 2 ]
  assert_output_contains "kerghan: error: unknown command 'frobnicate'"
  assert_output_contains "Usage: kerghan"
  [ -z "$(vault_calls)" ]
}

@test "no command prints the usage and exits 2" {
  run "$KERGHAN"
  [ "$status" -eq 2 ]
  assert_output_contains "Usage: kerghan"
}

@test "an unknown up flag prints the usage and exits 2" {
  run "$KERGHAN" up --bogus
  [ "$status" -eq 2 ]
  assert_output_contains "unknown option '--bogus'"
  assert_output_contains "Usage: kerghan"
  [ -z "$(vault_calls)" ]
}

@test "an unknown logs flag prints the usage and exits 2" {
  run "$KERGHAN" logs --tail
  [ "$status" -eq 2 ]
  assert_output_contains "Usage: kerghan"
}

@test "a non-numeric port is rejected" {
  run "$KERGHAN" up -p abc
  [ "$status" -eq 2 ]
  assert_output_contains "invalid port 'abc'"
  [ -z "$(vault_calls)" ]
}

@test "an out-of-range port is rejected" {
  run "$KERGHAN" up -p 70000
  [ "$status" -eq 2 ]
  run "$KERGHAN" up -p 0
  [ "$status" -eq 2 ]
  [ -z "$(vault_calls)" ]
}

@test "-p without a value is rejected" {
  run "$KERGHAN" up -p
  [ "$status" -eq 2 ]
  assert_output_contains "requires a value"
}

@test "version prints the pinned version" {
  run "$KERGHAN" version
  [ "$status" -eq 0 ]
  [ "$output" = "kerghan 0.5.0" ]
}

@test "the pinned version is a single column-0 KERGHAN_VERSION line" {
  [ "$(grep -c '^KERGHAN_VERSION=' "$KERGHAN")" -eq 1 ]
  grep -qx 'KERGHAN_VERSION="[0-9]*\.[0-9]*\.[0-9]*"' "$KERGHAN"
}

@test "help, -h and --help print the usage" {
  for arg in help -h --help; do
    run "$KERGHAN" "$arg"
    [ "$status" -eq 0 ]
    assert_output_contains "Usage: kerghan"
  done
}
