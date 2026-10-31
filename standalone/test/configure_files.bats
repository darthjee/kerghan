#!/usr/bin/env bats
# kerghan configure: the shared writer's file rules
# (docs/agents/standalone/client-config.md, "Files and the shared writer"):
# routing, missing files, existing content, values, writing, change list and
# apply hint.

load helpers/setup

UP_HINT="Run 'kerghan up' to apply (recreates the instance; data is kept)."
DOWN_UP_HINT="Run 'kerghan down && kerghan up' to apply."

# --- routing ---

@test "an upper-case key goes to kerghan.env and a lower-case key to config" {
  write_env_file
  run "$KERGHAN" configure MY_VAR=hello port=3002
  [ "$status" -eq 0 ]
  grep -qx 'MY_VAR=hello' "$ENV_FILE"
  ! grep -q 'MY_VAR' "$CONFIG_FILE"
  [ "$(cat "$CONFIG_FILE")" = "port=3002" ]
  ! grep -q 'port' "$ENV_FILE"
}

@test "a mixed-case key is a usage error" {
  write_env_file
  run "$KERGHAN" configure My_Var=1
  [ "$status" -eq 2 ]
  assert_output_contains "Usage: kerghan"
  [ ! -e "$CONFIG_FILE" ]
}

# --- missing files ---

@test "the listing without files shows the defaults and creates nothing" {
  run "$KERGHAN" configure
  [ "$status" -eq 0 ]
  assert_output_contains "port          3000"
  [ ! -e "$HOME/.kerghan" ]
  [ ! -s "$STUB_LOG" ]
}

@test "the first config write creates config with only that line" {
  write_env_file
  run "$KERGHAN" configure port=3002
  [ "$status" -eq 0 ]
  [ "$(cat "$CONFIG_FILE")" = "port=3002" ]
}

@test "an env write without kerghan.env and no volume creates it as up does" {
  run "$KERGHAN" configure MY_VAR=hello
  [ "$status" -eq 0 ]
  assert_output_contains "Generated secrets in $ENV_FILE"
  for key in KERGHAN_SECRET_KEY KERGHAN_INTEGRATIONS_KEY KERGHAN_DEFAULT_USER_ENABLED \
    KERGHAN_DEFAULT_USER_USERNAME KERGHAN_DEFAULT_USER_EMAIL KERGHAN_DEFAULT_USER_PASSWORD \
    KERGHAN_DEFAULT_USER_ADMIN; do
    grep -q "^$key=." "$ENV_FILE"
  done
  grep -qx 'MY_VAR=hello' "$ENV_FILE"
  [ "$(file_mode "$ENV_FILE")" = "600" ]
  assert_logged "docker volume inspect vault-kerghan-data"
}

@test "an env write without kerghan.env but with the volume is refused, config included" {
  export STUB_VOLUME_EXISTS=1
  run "$KERGHAN" configure port=3002 MY_VAR=hello
  [ "$status" -eq 1 ]
  assert_output_contains "kerghan.env is missing but the data volume vault-kerghan-data exists"
  assert_output_contains "restore kerghan.env from your backup"
  assert_output_contains "'kerghan reset'"
  [ ! -e "$ENV_FILE" ]
  [ ! -e "$CONFIG_FILE" ]
  refute_logged_prefix "openssl"
}

@test "a config-only write without kerghan.env but with the volume succeeds" {
  export STUB_VOLUME_EXISTS=1
  run "$KERGHAN" configure port=3002
  [ "$status" -eq 0 ]
  [ "$(cat "$CONFIG_FILE")" = "port=3002" ]
  [ ! -e "$ENV_FILE" ]
  refute_logged_prefix "docker"
}

@test "no Docker call is made when kerghan.env exists" {
  write_env_file
  run "$KERGHAN" configure MY_VAR=hello port=3002
  [ "$status" -eq 0 ]
  run "$KERGHAN" configure
  [ "$status" -eq 0 ]
  run "$KERGHAN" configure --unset MY_VAR
  [ "$status" -eq 0 ]
  refute_logged_prefix "docker"
  refute_logged_prefix "vault"
}

# --- existing content ---

@test "the listing marks an invalid config line" {
  write_env_file
  write_config "runtime=sysbox2"
  run "$KERGHAN" configure
  [ "$status" -eq 0 ]
  assert_output_contains "sysbox2"
  assert_output_contains "file, invalid"
}

@test "setting the invalid key fixes the file" {
  write_env_file
  write_config "runtime=sysbox2" "port=3001"
  run "$KERGHAN" configure runtime=sysbox
  [ "$status" -eq 0 ]
  [ "$(cat "$CONFIG_FILE")" = "runtime=sysbox
port=3001" ]
}

@test "unsetting the invalid key fixes the file" {
  write_env_file
  write_config "runtime=sysbox2" "port=3001"
  run "$KERGHAN" configure --unset runtime
  [ "$status" -eq 0 ]
  [ "$(cat "$CONFIG_FILE")" = "port=3001" ]
}

@test "setting another key with an invalid line is refused with the line number" {
  write_env_file
  write_config "port=3001" "runtime=sysbox2"
  cp "$CONFIG_FILE" "$TEST_ROOT/before"
  cp "$ENV_FILE" "$TEST_ROOT/env-before"
  run "$KERGHAN" configure port=3002 MY_VAR=1
  [ "$status" -eq 1 ]
  assert_output_contains "$CONFIG_FILE:2: invalid runtime 'sysbox2'"
  cmp "$CONFIG_FILE" "$TEST_ROOT/before"
  cmp "$ENV_FILE" "$TEST_ROOT/env-before"
}

@test "a config line without = is refused and asks for a manual fix" {
  write_env_file
  write_config "port=3001" "oops"
  cp "$CONFIG_FILE" "$TEST_ROOT/before"
  run "$KERGHAN" configure port=3002
  [ "$status" -eq 1 ]
  assert_output_contains "$CONFIG_FILE:2: expected key=value"
  assert_output_contains "by hand"
  cmp "$CONFIG_FILE" "$TEST_ROOT/before"
}

@test "a set on a duplicate key rewrites the last line, removes the others and warns" {
  write_env_file
  write_config "port=3001" "# keep" "port=3005" "bind=127.0.0.1"
  run "$KERGHAN" configure port=3002
  [ "$status" -eq 0 ]
  assert_output_contains "warning:"
  [ "$(cat "$CONFIG_FILE")" = "# keep
port=3002
bind=127.0.0.1" ]
  assert_output_contains "port: 3005 -> 3002"
}

@test "a set on a duplicate env key rewrites the last line and removes the others" {
  write_env_file "MY_VAR=a" "OTHER=x" "MY_VAR=b"
  run "$KERGHAN" configure MY_VAR=c
  [ "$status" -eq 0 ]
  assert_output_contains "warning:"
  [ "$(grep -c '^MY_VAR=' "$ENV_FILE")" -eq 1 ]
  [ "$(tail -n 1 "$ENV_FILE")" = "MY_VAR=c" ]
  [ "$(tail -n 2 "$ENV_FILE" | head -n 1)" = "OTHER=x" ]
}

@test "--unset removes every copy of a duplicate key" {
  write_env_file "MY_VAR=a" "MY_VAR=b"
  write_config "port=3001" "port=3005"
  run "$KERGHAN" configure --unset port --unset MY_VAR
  [ "$status" -eq 0 ]
  ! grep -q 'port' "$CONFIG_FILE"
  ! grep -q 'MY_VAR' "$ENV_FILE"
}

@test "a set uncomments the #port= template line and keeps the comment above it" {
  write_env_file
  write_config "# Host port." "#port=3000" "" "#variant=online"
  run "$KERGHAN" configure port=3002
  [ "$status" -eq 0 ]
  [ "$(cat "$CONFIG_FILE")" = "# Host port.
port=3002

#variant=online" ]
}

@test "with two template lines only the first one changes" {
  write_env_file
  write_config "#port=3000" "#port=4000"
  run "$KERGHAN" configure port=3002
  [ "$status" -eq 0 ]
  [ "$(cat "$CONFIG_FILE")" = "port=3002
#port=4000" ]
}

@test "without a template line the key is appended" {
  write_env_file
  write_config "# settings" "variant=online"
  run "$KERGHAN" configure port=3002
  [ "$status" -eq 0 ]
  [ "$(cat "$CONFIG_FILE")" = "# settings
variant=online
port=3002" ]
}

@test "a #KEY= line in kerghan.env is left alone and the key appended" {
  write_env_file "#MY_VAR=old"
  run "$KERGHAN" configure MY_VAR=new
  [ "$status" -eq 0 ]
  grep -qx '#MY_VAR=old' "$ENV_FILE"
  [ "$(tail -n 1 "$ENV_FILE")" = "MY_VAR=new" ]
}

@test "an unknown lower-case key is refused" {
  write_env_file
  run "$KERGHAN" configure portt=3002
  [ "$status" -eq 1 ]
  assert_output_contains "unknown key 'portt'"
  assert_output_contains "port, variant, runtime, stop-timeout, image-tag, auto-login, bind"
  [ ! -e "$CONFIG_FILE" ]
}

@test "an unknown upper-case key is written verbatim" {
  write_env_file
  run "$KERGHAN" configure MY_CUSTOM_VAR=hello
  [ "$status" -eq 0 ]
  [ "$(tail -n 1 "$ENV_FILE")" = "MY_CUSTOM_VAR=hello" ]
}

@test "an unknown key already in config is kept and listed as unknown (ignored)" {
  write_env_file
  write_config "colour=blue" "port=3001"
  run "$KERGHAN" configure
  [ "$status" -eq 0 ]
  assert_output_contains "colour"
  assert_output_contains "unknown (ignored)"
  run "$KERGHAN" configure port=3002
  [ "$status" -eq 0 ]
  [ "$(cat "$CONFIG_FILE")" = "colour=blue
port=3002" ]
}

# --- values ---

@test "a value with a newline is refused" {
  write_env_file
  run "$KERGHAN" configure "MY_VAR=a
b"
  [ "$status" -eq 1 ]
  ! grep -q MY_VAR "$ENV_FILE"
  run "$KERGHAN" configure "image-tag=a
b"
  [ "$status" -eq 1 ]
  [ ! -e "$CONFIG_FILE" ]
}

@test "a config value with # is refused" {
  write_env_file
  run "$KERGHAN" configure "image-tag=1#2"
  [ "$status" -eq 1 ]
  [ ! -e "$CONFIG_FILE" ]
}

@test "an env value with # and spaces is written verbatim" {
  write_env_file
  run "$KERGHAN" configure "MY_VAR= a # b  "
  [ "$status" -eq 0 ]
  grep -qxF 'MY_VAR= a # b  ' "$ENV_FILE"
}

@test "an empty value is refused for a config key and an env key" {
  write_env_file
  cp "$ENV_FILE" "$TEST_ROOT/before"
  run "$KERGHAN" configure port=
  [ "$status" -eq 1 ]
  assert_output_contains "--unset port"
  run "$KERGHAN" configure KERGHAN_DEFAULT_USER_EMAIL=
  [ "$status" -eq 1 ]
  [ ! -e "$CONFIG_FILE" ]
  cmp "$ENV_FILE" "$TEST_ROOT/before"
}

@test "--unset of each generated env key is refused" {
  write_env_file
  cp "$ENV_FILE" "$TEST_ROOT/before"
  for key in KERGHAN_SECRET_KEY KERGHAN_INTEGRATIONS_KEY KERGHAN_DEFAULT_USER_ENABLED \
    KERGHAN_DEFAULT_USER_USERNAME KERGHAN_DEFAULT_USER_EMAIL KERGHAN_DEFAULT_USER_PASSWORD \
    KERGHAN_DEFAULT_USER_ADMIN; do
    run "$KERGHAN" configure --unset "$key"
    [ "$status" -eq 1 ]
    assert_output_contains "$key cannot be unset"
  done
  cmp "$ENV_FILE" "$TEST_ROOT/before"
}

@test "--unset of FRONTEND_BASE_URL and of a custom key removes the line" {
  write_env_file "FRONTEND_BASE_URL=https://a.example" "MY_VAR=1"
  run "$KERGHAN" configure --unset FRONTEND_BASE_URL --unset MY_VAR
  [ "$status" -eq 0 ]
  ! grep -q FRONTEND_BASE_URL "$ENV_FILE"
  ! grep -q MY_VAR "$ENV_FILE"
  assert_output_contains "FRONTEND_BASE_URL: https://a.example -> (not set)"
  assert_output_contains "MY_VAR: 1 -> (not set)"
}

@test "--unset of a key with no line changes nothing" {
  write_env_file
  write_config "variant=online"
  cp "$ENV_FILE" "$TEST_ROOT/env-before"
  cp "$CONFIG_FILE" "$TEST_ROOT/before"
  run "$KERGHAN" configure --unset MY_VAR --unset port
  [ "$status" -eq 0 ]
  assert_output_contains "Nothing changed."
  cmp "$ENV_FILE" "$TEST_ROOT/env-before"
  cmp "$CONFIG_FILE" "$TEST_ROOT/before"
}

@test "known env keys are validated" {
  write_env_file
  cp "$ENV_FILE" "$TEST_ROOT/before"
  run "$KERGHAN" configure KERGHAN_DEFAULT_USER_ENABLED=yes
  [ "$status" -eq 1 ]
  run "$KERGHAN" configure KERGHAN_DEFAULT_USER_ADMIN=1
  [ "$status" -eq 1 ]
  run "$KERGHAN" configure KERGHAN_DEFAULT_USER_PASSWORD=1234567
  [ "$status" -eq 1 ]
  run "$KERGHAN" configure FRONTEND_BASE_URL=ftp://x
  [ "$status" -eq 1 ]
  cmp "$ENV_FILE" "$TEST_ROOT/before"
}

# --- writing ---

@test "a set keeps the line position and every other line byte for byte" {
  write_env_file
  mkdir -p "$HOME/.kerghan"
  printf '# top  \n\n  colour = blue # mine\nport=3001\n#variant=online\nbind=127.0.0.1\n' >"$CONFIG_FILE"
  run "$KERGHAN" configure port=3002
  [ "$status" -eq 0 ]
  printf '# top  \n\n  colour = blue # mine\nport=3002\n#variant=online\nbind=127.0.0.1\n' >"$TEST_ROOT/expected"
  cmp "$CONFIG_FILE" "$TEST_ROOT/expected"
}

@test "appending to a file without a final newline adds one first" {
  write_env_file
  printf 'MY_VAR=1' >>"$ENV_FILE"
  run "$KERGHAN" configure OTHER=2
  [ "$status" -eq 0 ]
  [ "$(tail -n 2 "$ENV_FILE")" = "MY_VAR=1
OTHER=2" ]
  [ -z "$(tail -c1 "$ENV_FILE")" ]
}

@test "a set leaves kerghan.env at 600 and keeps a 640 config at 640" {
  write_env_file
  write_config "port=3001"
  chmod 640 "$CONFIG_FILE"
  run "$KERGHAN" configure port=3002 MY_VAR=1
  [ "$status" -eq 0 ]
  [ "$(file_mode "$ENV_FILE")" = "600" ]
  [ "$(file_mode "$CONFIG_FILE")" = "640" ]
}

@test "a failed write leaves the original file untouched and no temp file" {
  write_env_file
  write_config "port=3001"
  cp "$CONFIG_FILE" "$TEST_ROOT/before"
  cp "$BATS_TEST_DIRNAME/stubs/mv" "$STUB_BIN/mv"
  chmod +x "$STUB_BIN/mv"
  export STUB_MV_FAIL=1
  run "$KERGHAN" configure port=3002
  [ "$status" -eq 1 ]
  assert_output_contains "could not write"
  cmp "$CONFIG_FILE" "$TEST_ROOT/before"
  [ "$(ls -A "$HOME/.kerghan" | sort | tr '\n' ' ')" = "config kerghan.env " ]
}

@test "a symlinked config is written through to its target and stays a symlink" {
  write_env_file
  mkdir -p "$TEST_ROOT/dotfiles"
  printf 'port=3001\n' >"$TEST_ROOT/dotfiles/kerghan-config"
  ln -s "$TEST_ROOT/dotfiles/kerghan-config" "$CONFIG_FILE"
  run "$KERGHAN" configure port=3002
  [ "$status" -eq 0 ]
  [ -L "$CONFIG_FILE" ]
  [ "$(cat "$TEST_ROOT/dotfiles/kerghan-config")" = "port=3002" ]
  [ "$(ls -A "$TEST_ROOT/dotfiles")" = "kerghan-config" ]
}

@test "setting a key to its current value changes nothing" {
  write_env_file "MY_VAR=1"
  write_config "port=3001"
  make_old "$CONFIG_FILE"
  make_old "$ENV_FILE"
  run "$KERGHAN" configure port=3001 MY_VAR=1
  [ "$status" -eq 0 ]
  [ "$output" = "Nothing changed." ]
  [ ! "$CONFIG_FILE" -nt "$TEST_ROOT/old-ref" ]
  [ ! "$ENV_FILE" -nt "$TEST_ROOT/old-ref" ]
}

# --- change list and apply hint ---

@test "the change list shows old -> new with (default) and (not set)" {
  write_env_file
  write_config "image-tag=0.8.0"
  run "$KERGHAN" configure port=3002 FRONTEND_BASE_URL=https://kerghan.example.com --unset image-tag
  [ "$status" -eq 0 ]
  [ "${lines[0]}" = "port: 3000 (default) -> 3002" ]
  [ "${lines[1]}" = "FRONTEND_BASE_URL: (not set) -> https://kerghan.example.com" ]
  [ "${lines[2]}" = "image-tag: 0.8.0 -> (default)" ]
}

@test "port alone prints the kerghan up hint" {
  write_env_file
  run "$KERGHAN" configure port=3002
  [ "$status" -eq 0 ]
  assert_output_contains "$UP_HINT"
  refute_output_contains "$DOWN_UP_HINT"
}

@test "runtime alone, an env key, and port with runtime print only the down && up hint" {
  write_env_file
  run "$KERGHAN" configure runtime=privileged
  [ "$status" -eq 0 ]
  assert_output_contains "$DOWN_UP_HINT"
  refute_output_contains "$UP_HINT"
  run "$KERGHAN" configure MY_VAR=1
  [ "$status" -eq 0 ]
  assert_output_contains "$DOWN_UP_HINT"
  refute_output_contains "$UP_HINT"
  run "$KERGHAN" configure port=3002 runtime=sysbox
  [ "$status" -eq 0 ]
  assert_output_contains "$DOWN_UP_HINT"
  refute_output_contains "$UP_HINT"
}

@test "a password change adds the sessions note" {
  write_env_file
  run "$KERGHAN" configure KERGHAN_DEFAULT_USER_PASSWORD=new-password-123
  [ "$status" -eq 0 ]
  assert_output_contains "$DOWN_UP_HINT"
  assert_output_contains "sessions are revoked"
}
