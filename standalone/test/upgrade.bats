#!/usr/bin/env bats
# Comparing with the running instance: no-op, upgrade, variant swap, port
# change, downgrade and non-release images.

load helpers/setup

IMAGE="darthjee/kerghan-standalone:0.5.0"

@test "the same image and port is a no-op that prints the URL" {
  write_env_file
  export STUB_RUNNING_IMAGE="$IMAGE" STUB_RUNNING_PORT=3000
  run "$KERGHAN" up
  [ "$status" -eq 0 ]
  assert_output_contains "Kerghan is already running at http://localhost:3000"
  [ -z "$(vault_calls)" ]
}

@test "the same offline image and custom port is a no-op" {
  write_env_file
  export STUB_RUNNING_IMAGE="$IMAGE-offline" STUB_RUNNING_PORT=8080
  run "$KERGHAN" up --offline -p 8080
  [ "$status" -eq 0 ]
  assert_output_contains "Kerghan is already running at http://localhost:8080"
  [ -z "$(vault_calls)" ]
}

@test "an older running version is recreated with the new image, keeping the volume" {
  write_env_file
  export STUB_VOLUME_EXISTS=1 STUB_RUNNING_IMAGE="darthjee/kerghan-standalone:0.4.0"
  run "$KERGHAN" up
  [ "$status" -eq 0 ]
  assert_output_contains "upgrading darthjee/kerghan-standalone:0.4.0 -> $IMAGE"
  [ "$(vault_calls | sed -n 1p)" = "vault down --name kerghan" ]
  [ "$(vault_calls | sed -n 2p)" = "vault up --name kerghan --image $IMAGE --env-file $ENV_FILE -p 3000:80 -e FRONTEND_BASE_URL=http://localhost:3000" ]
  refute_logged_prefix "docker volume rm"
}

@test "an older offline version is upgraded with the offline image" {
  write_env_file
  export STUB_RUNNING_IMAGE="darthjee/kerghan-standalone:0.4.9-offline"
  run "$KERGHAN" up --offline
  [ "$status" -eq 0 ]
  assert_output_contains "upgrading"
  [ "$(vault_calls | sed -n 2p)" = "vault up --name kerghan --image $IMAGE-offline --env-file $ENV_FILE -p 3000:80 -e FRONTEND_BASE_URL=http://localhost:3000" ]
}

@test "switching online to offline recreates the instance" {
  write_env_file
  export STUB_RUNNING_IMAGE="$IMAGE"
  run "$KERGHAN" up --offline
  [ "$status" -eq 0 ]
  assert_output_contains "switching to the offline variant"
  [ "$(vault_calls | sed -n 1p)" = "vault down --name kerghan" ]
  [ "$(vault_calls | sed -n 2p)" = "vault up --name kerghan --image $IMAGE-offline --env-file $ENV_FILE -p 3000:80 -e FRONTEND_BASE_URL=http://localhost:3000" ]
  refute_logged_prefix "docker volume rm"
}

@test "switching offline to online recreates the instance" {
  write_env_file
  export STUB_RUNNING_IMAGE="$IMAGE-offline"
  run "$KERGHAN" up
  [ "$status" -eq 0 ]
  assert_output_contains "switching to the online variant"
  [ "$(vault_calls | sed -n 1p)" = "vault down --name kerghan" ]
  vault_calls | sed -n 2p | grep -q -- "--image $IMAGE --env-file"
}

@test "a port change recreates the instance" {
  write_env_file
  export STUB_RUNNING_IMAGE="$IMAGE" STUB_RUNNING_PORT=3000
  run "$KERGHAN" up -p 8080
  [ "$status" -eq 0 ]
  assert_output_contains "moving to port 8080"
  [ "$(vault_calls | sed -n 1p)" = "vault down --name kerghan" ]
  [ "$(vault_calls | sed -n 2p)" = "vault up --name kerghan --image $IMAGE --env-file $ENV_FILE -p 8080:80 -e FRONTEND_BASE_URL=http://localhost:8080" ]
  refute_logged_prefix "docker volume rm"
}

@test "a newer running version warns about the downgrade and is not recreated" {
  write_env_file
  export STUB_RUNNING_IMAGE="darthjee/kerghan-standalone:0.6.0"
  run "$KERGHAN" up
  [ "$status" -eq 1 ]
  assert_output_contains "kerghan: warning: the running instance uses darthjee/kerghan-standalone:0.6.0, newer than this CLI (0.5.0); downgrades are unsupported"
  assert_output_contains "kerghan: hint: install the kerghan CLI 0.6.0"
  [ -z "$(vault_calls)" ]
}

@test "a non-semver tag is recreated with a warning" {
  write_env_file
  export STUB_RUNNING_IMAGE="darthjee/kerghan-standalone:dev"
  run "$KERGHAN" up
  [ "$status" -eq 0 ]
  assert_output_contains "kerghan: warning: the running instance uses darthjee/kerghan-standalone:dev"
  [ "$(vault_calls | sed -n 1p)" = "vault down --name kerghan" ]
  vault_calls | sed -n 2p | grep -q -- "--image $IMAGE --env-file"
}

@test "a stopped container counts as no running instance" {
  write_env_file
  export STUB_RUNNING_IMAGE="darthjee/kerghan-standalone:0.6.0" STUB_RUNNING_STATE=false
  run "$KERGHAN" up
  [ "$status" -eq 0 ]
  [ "$(vault_calls)" = "vault up --name kerghan --image $IMAGE --env-file $ENV_FILE -p 3000:80 -e FRONTEND_BASE_URL=http://localhost:3000" ]
}

@test "version_compare orders plain semver numerically" {
  source "$KERGHAN"
  [ "$(version_compare 0.5.0 0.5.0)" = "eq" ]
  [ "$(version_compare 0.4.0 0.5.0)" = "lt" ]
  [ "$(version_compare 0.6.0 0.5.0)" = "gt" ]
  [ "$(version_compare 0.5.0 0.10.0)" = "lt" ]
  [ "$(version_compare 1.0.0 0.99.99)" = "gt" ]
  [ "$(version_compare 0.5.1 0.5.0)" = "gt" ]
  [ "$(version_compare 0.5.09 0.5.9)" = "eq" ]
}

@test "is_semver accepts x.y.z only" {
  source "$KERGHAN"
  is_semver 0.5.0
  is_semver 10.20.30
  ! is_semver dev
  ! is_semver latest
  ! is_semver 0.5
  ! is_semver 0.5.0.1
  ! is_semver 0.5.0-rc1
}
