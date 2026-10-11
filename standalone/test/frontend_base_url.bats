#!/usr/bin/env bats
# FRONTEND_BASE_URL defaults to the effective port unless kerghan.env sets it.

load helpers/setup

@test "up passes FRONTEND_BASE_URL for the default port" {
  write_env_file
  run "$KERGHAN" up
  [ "$status" -eq 0 ]
  vault_calls | grep -q -- '-e FRONTEND_BASE_URL=http://localhost:3000 --runtime auto --stop-timeout 60$'
}

@test "up passes FRONTEND_BASE_URL for a custom port" {
  write_env_file
  run "$KERGHAN" up -p 8080
  [ "$status" -eq 0 ]
  vault_calls | grep -q -- '-e FRONTEND_BASE_URL=http://localhost:8080 --runtime auto --stop-timeout 60$'
}

@test "kerghan.env's FRONTEND_BASE_URL wins: no -e is passed" {
  write_env_file "FRONTEND_BASE_URL=https://kerghan.example.com"
  run "$KERGHAN" up -p 8080
  [ "$status" -eq 0 ]
  [ "$(vault_calls)" = "vault up --name kerghan --image $IMAGE --env-file $ENV_FILE -p 8080:80 --runtime auto --stop-timeout 60" ]
}
