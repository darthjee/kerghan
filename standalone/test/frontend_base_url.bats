#!/usr/bin/env bats
# FRONTEND_BASE_URL defaults to the advertised URL (the published address of the
# effective bind and port) unless kerghan.env sets it.

load helpers/setup

# assert_derived_url <url> - the vault up line carries -e FRONTEND_BASE_URL=<url>.
assert_derived_url() {
  vault_calls | grep -qF -- "-e FRONTEND_BASE_URL=$1 -e KERGHAN_DEFAULT_USER_ALWAYS_AUTHENTICATED="
}

@test "up passes FRONTEND_BASE_URL for the default port" {
  write_env_file
  run "$KERGHAN" up
  [ "$status" -eq 0 ]
  vault_calls | grep -qF -- "-e FRONTEND_BASE_URL=http://127.0.0.1:3000 $DEFAULT_USER_ARGS --runtime auto --stop-timeout 60"
}

@test "up passes FRONTEND_BASE_URL for a custom port" {
  write_env_file
  run "$KERGHAN" up -p 8080
  [ "$status" -eq 0 ]
  vault_calls | grep -qF -- "-e FRONTEND_BASE_URL=http://127.0.0.1:8080 $DEFAULT_USER_ARGS --runtime auto --stop-timeout 60"
}

@test "another loopback bind derives FRONTEND_BASE_URL from it" {
  write_env_file
  run "$KERGHAN" up --bind 127.0.0.2 -p 8080
  [ "$status" -eq 0 ]
  assert_derived_url "http://127.0.0.2:8080"
}

@test "bind 0.0.0.0 derives FRONTEND_BASE_URL on 127.0.0.1" {
  write_env_file
  run "$KERGHAN" up --bind 0.0.0.0
  [ "$status" -eq 0 ]
  assert_derived_url "http://127.0.0.1:3000"
}

@test "the auto-login-off default bind derives FRONTEND_BASE_URL on 127.0.0.1" {
  write_env_file
  run "$KERGHAN" up --no-auto-login
  [ "$status" -eq 0 ]
  assert_derived_url "http://127.0.0.1:3000"
}

@test "a LAN bind derives FRONTEND_BASE_URL from it" {
  write_env_file
  write_config "bind=192.168.1.5"
  run "$KERGHAN" up
  [ "$status" -eq 0 ]
  assert_derived_url "http://192.168.1.5:3000"
}

@test "kerghan.env's FRONTEND_BASE_URL wins: no -e is passed" {
  write_env_file "FRONTEND_BASE_URL=https://kerghan.example.com"
  run "$KERGHAN" up -p 8080
  [ "$status" -eq 0 ]
  [ "$(vault_calls)" = "vault up --name kerghan --image $IMAGE --env-file $ENV_FILE -p 127.0.0.1:8080:80 $(default_user_args true true) --runtime auto --stop-timeout 60" ]
}

@test "a user-set FRONTEND_BASE_URL does not change the printed URL" {
  write_env_file "FRONTEND_BASE_URL=https://kerghan.example.com"
  run "$KERGHAN" up --bind 192.168.1.5 -p 8080
  [ "$status" -eq 0 ]
  assert_output_contains "Kerghan is running at http://192.168.1.5:8080"
  refute_output_contains "Kerghan is running at https://kerghan.example.com"
  [[ "$(vault_calls)" != *FRONTEND_BASE_URL* ]]
  grep -qx 'FRONTEND_BASE_URL=https://kerghan.example.com' "$ENV_FILE"
}

@test "a user-set localhost FRONTEND_BASE_URL is kept as it is" {
  write_env_file "FRONTEND_BASE_URL=http://localhost:3000"
  run "$KERGHAN" up
  [ "$status" -eq 0 ]
  assert_output_contains "Kerghan is running at http://127.0.0.1:3000"
  [[ "$(vault_calls)" != *FRONTEND_BASE_URL* ]]
  grep -qx 'FRONTEND_BASE_URL=http://localhost:3000' "$ENV_FILE"
}
