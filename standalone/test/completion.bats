#!/usr/bin/env bats
# The bash completion function _kerghan: the per-position table, the edge
# cases, the registration and the dual = shapes
# (docs/agents/specs/auto-complete/completion.md). Runs on bash 5 and bash 3.2.

load helpers/setup
load helpers/completion

# --- Registration ----------------------------------------------------------

@test "contract _kerghan: complete -p kerghan prints the registration line" {
  source_completion
  run complete -p kerghan
  [ "$status" -eq 0 ]
  [ "$output" = "complete -o nospace -F _kerghan kerghan" ]
}

# --- Top level -------------------------------------------------------------

@test "matrix top-first: kerghan <TAB> offers every command" {
  source_completion
  complete_line "kerghan "
  assert_reply "${ALL_COMMANDS[@]}"
}

@test "matrix top-first: kerghan co<TAB> filters by prefix" {
  source_completion
  complete_line "kerghan co"
  assert_reply "compose " "completion " "configure "
}

@test "matrix top-first: kerghan up<TAB> offers up, update and update-env" {
  source_completion
  complete_line "kerghan up"
  assert_reply "up " "update " "update-env "
}

@test "edge 12: help at the top level (top-first), kerghan -<TAB> offers -h and --help" {
  source_completion
  complete_line "kerghan -"
  assert_reply "-h " "--help "
}

@test "edge 4: unknown command, kerghan foo <TAB> offers nothing (top-later)" {
  source_completion
  complete_line "kerghan foo "
  assert_no_reply
}

@test "matrix top-later: edge 4: kerghan -h <TAB> offers nothing" {
  source_completion
  complete_line "kerghan -h "
  assert_no_reply
}

@test "matrix top-later: edge 4: kerghan --help <TAB> offers nothing" {
  source_completion
  complete_line "kerghan --help "
  assert_no_reply
}

@test "edge 1: called by path, ./kerghan completes like kerghan" {
  source_completion
  complete_line "./kerghan "
  assert_reply "${ALL_COMMANDS[@]}"
  complete_line "~/.local/bin/kerghan up "
  assert_reply "${UP_FLAGS[@]}"
}

# --- up --------------------------------------------------------------------

@test "matrix up-flags: edge 12: kerghan up <TAB> offers the up flags and no help" {
  source_completion
  complete_line "kerghan up "
  assert_reply "${UP_FLAGS[@]}"
}

@test "matrix up-flags: edge 12: kerghan up -<TAB> offers the up flags" {
  source_completion
  complete_line "kerghan up -"
  assert_reply "${UP_FLAGS[@]}"
}

@test "edge 9: a flag on the line is not offered again (up-flags)" {
  source_completion
  complete_line "kerghan up --offline "
  minus UP_FLAGS "--offline "
  assert_reply "${EXPECTED[@]}"
}

@test "matrix up-flags: edge 9: -p on the line removes -p and --port" {
  source_completion
  complete_line "kerghan up -p 8080 "
  minus UP_FLAGS "-p " "--port "
  assert_reply "${EXPECTED[@]}"
}

@test "matrix up-flags: edge 9: --port on the line removes -p and --port" {
  source_completion
  complete_line "kerghan up --port 8080 "
  minus UP_FLAGS "-p " "--port "
  assert_reply "${EXPECTED[@]}"
}

@test "edge 10: mutually exclusive pair (up-flags): --auto-login removes both auto-login flags" {
  source_completion
  complete_line "kerghan up --auto-login "
  minus UP_FLAGS "--auto-login " "--no-auto-login "
  assert_reply "${EXPECTED[@]}"
}

@test "matrix up-flags: edge 10: --no-auto-login removes both auto-login flags" {
  source_completion
  complete_line "kerghan up --no-auto-login "
  minus UP_FLAGS "--auto-login " "--no-auto-login "
  assert_reply "${EXPECTED[@]}"
}

@test "edge 8: free-form flag argument, kerghan up -p <TAB> offers nothing (up-flag-arg)" {
  source_completion
  complete_line "kerghan up -p "
  assert_no_reply
}

@test "matrix up-flag-arg: edge 8: kerghan up --port <TAB> offers nothing" {
  source_completion
  complete_line "kerghan up --port "
  assert_no_reply
}

@test "matrix up-flag-arg: edge 8: kerghan up --bind <TAB> offers nothing" {
  source_completion
  complete_line "kerghan up --bind "
  assert_no_reply
}

@test "matrix up-flag-arg: edge 8: the --bind argument is never read as a flag" {
  source_completion
  complete_line "kerghan up --bind -"
  assert_no_reply
}

# --- logs, update, wizard, completion ---------------------------------------

@test "matrix logs: kerghan logs <TAB> offers -f" {
  source_completion
  complete_line "kerghan logs "
  assert_reply "-f "
}

@test "edge 6: logs beyond -f, kerghan logs -f <TAB> offers nothing (logs)" {
  source_completion
  complete_line "kerghan logs -f "
  assert_no_reply
}

@test "matrix update: kerghan update <TAB> offers the update flags" {
  source_completion
  complete_line "kerghan update "
  assert_reply "${UPDATE_FLAGS[@]}"
}

@test "matrix update: edge 9: --force on the line is not offered again" {
  source_completion
  complete_line "kerghan update --force "
  assert_reply "--yes " "--restart " "--no-restart "
}

@test "matrix update: edge 10: --restart removes both restart flags" {
  source_completion
  complete_line "kerghan update --restart "
  assert_reply "--force " "--yes "
}

@test "matrix update: edge 10: --no-restart removes both restart flags" {
  source_completion
  complete_line "kerghan update --no-restart "
  assert_reply "--force " "--yes "
}

@test "edge 7: update VERSION (update): a VERSION on the line changes nothing" {
  source_completion
  complete_line "kerghan update 0.9.0 "
  assert_reply "${UPDATE_FLAGS[@]}"
}

@test "edge 11: hidden steps (update): --f offers --force, never --finish" {
  source_completion
  complete_line "kerghan update --f"
  assert_reply "--force "
}

@test "matrix wizard: kerghan wizard <TAB> offers --advanced" {
  source_completion
  complete_line "kerghan wizard "
  assert_reply "--advanced "
}

@test "matrix wizard: edge 9: kerghan wizard --advanced <TAB> offers nothing" {
  source_completion
  complete_line "kerghan wizard --advanced "
  assert_no_reply
}

@test "matrix completion-first: kerghan completion <TAB> offers bash" {
  source_completion
  complete_line "kerghan completion "
  assert_reply "bash "
}

@test "matrix completion-first: kerghan completion b<TAB> offers bash" {
  source_completion
  complete_line "kerghan completion b"
  assert_reply "bash "
}

@test "matrix completion-later: kerghan completion bash <TAB> offers nothing" {
  source_completion
  complete_line "kerghan completion bash "
  assert_no_reply
}

@test "edge 5: nothing left to offer (no-args): down, status, reset, update-env, version and help offer nothing" {
  source_completion
  local cmd
  for cmd in down status reset update-env version help; do
    complete_line "kerghan $cmd "
    assert_no_reply
  done
}

@test "matrix no-args: edge 6: compose arguments are never completed" {
  source_completion
  complete_line "kerghan compose "
  assert_no_reply
  complete_line "kerghan compose ps "
  assert_no_reply
}

# --- configure -------------------------------------------------------------

@test "matrix cfg-other: kerghan configure <TAB> offers the flags and every KEY=" {
  source_completion
  complete_line "kerghan configure "
  assert_reply "--show-secrets " "--force " "--unset " "${CONFIG_KEYS_EQ[@]}" "${ENV_KEYS_EQ[@]}"
}

@test "edge 13: key with = attached (cfg-other), kerghan configure var<TAB> offers variant= with no space" {
  source_completion
  complete_line "kerghan configure var"
  assert_reply "variant="
}

@test "matrix cfg-other: edge 9: --force on the line drops --show-secrets and --force" {
  source_completion
  complete_line "kerghan configure --force "
  assert_reply "--unset " "${CONFIG_KEYS_EQ[@]}" "${ENV_KEYS_EQ[@]}"
}

@test "edge 17: keys already on the line (cfg-other): a KEY= on the line is not offered again" {
  source_completion
  complete_words "kerghan configure variant=x " -- kerghan configure variant = x ''
  minus CONFIG_KEYS_EQ "variant="
  assert_reply "--force " "--unset " "${EXPECTED[@]}" "${ENV_KEYS_EQ[@]}"
}

@test "matrix cfg-other: edges 16, 17: a KEY=- on the line leaves KEY= candidates offered" {
  source_completion
  complete_words "kerghan configure port=- " -- kerghan configure port = - ''
  minus CONFIG_KEYS_EQ "port="
  assert_reply "--force " "--unset " "${EXPECTED[@]}" "${ENV_KEYS_EQ[@]}"
}

@test "matrix cfg-other: edge 17: a key after --unset is not offered again" {
  source_completion
  complete_line "kerghan configure --unset port "
  minus CONFIG_KEYS_EQ "port="
  assert_reply "--force " "--unset " "${EXPECTED[@]}" "${ENV_KEYS_EQ[@]}"
}

@test "matrix cfg-show-secrets: kerghan configure --show-secrets <TAB> offers nothing" {
  source_completion
  complete_line "kerghan configure --show-secrets "
  assert_no_reply
}

@test "edge 14: --unset <TAB> offers the bare --unset keys" {
  source_completion
  complete_line "kerghan configure --unset "
  assert_reply "${UNSET_KEYS[@]}"
}

@test "edge 15: static env keys only: --unset never offers a DEFAULT_ENV_KEYS name" {
  source_completion
  complete_line "kerghan configure --unset K"
  assert_no_reply
  complete_line "kerghan configure K"
  assert_reply "KERGHAN_SECRET_KEY=" "KERGHAN_INTEGRATIONS_KEY=" "KERGHAN_DEFAULT_USER_ENABLED=" \
    "KERGHAN_DEFAULT_USER_USERNAME=" "KERGHAN_DEFAULT_USER_EMAIL=" \
    "KERGHAN_DEFAULT_USER_PASSWORD=" "KERGHAN_DEFAULT_USER_ADMIN="
}

@test "matrix cfg-unset: edge 17: a key already unset is not offered again" {
  source_completion
  complete_line "kerghan configure --unset port --unset "
  minus UNSET_KEYS "port "
  assert_reply "${EXPECTED[@]}"
}

@test "matrix cfg-value: edge 13: variant= offers online and offline (both shapes)" {
  source_completion
  complete_words "kerghan configure variant=" -- kerghan configure variant =
  assert_reply "online " "offline "
  complete_words "kerghan configure variant=" -- kerghan configure variant = ''
  assert_reply "online " "offline "
}

@test "matrix cfg-value: edge 13: variant=on offers online" {
  source_completion
  complete_words "kerghan configure variant=on" -- kerghan configure variant = on
  assert_reply "online "
}

@test "matrix cfg-value: edge 13: runtime= offers auto, sysbox and privileged (both shapes)" {
  source_completion
  complete_words "kerghan configure runtime=" -- kerghan configure runtime =
  assert_reply "auto " "sysbox " "privileged "
  complete_words "kerghan configure runtime=" -- kerghan configure runtime = ''
  assert_reply "auto " "sysbox " "privileged "
}

@test "matrix cfg-value: edge 13: runtime=s offers sysbox" {
  source_completion
  complete_words "kerghan configure runtime=s" -- kerghan configure runtime = s
  assert_reply "sysbox "
}

@test "matrix cfg-value: edge 13: auto-login= offers true and false (both shapes)" {
  source_completion
  complete_words "kerghan configure auto-login=" -- kerghan configure auto-login =
  assert_reply "true " "false "
  complete_words "kerghan configure auto-login=" -- kerghan configure auto-login = ''
  assert_reply "true " "false "
}

@test "matrix cfg-value: edge 13: auto-login=t offers true" {
  source_completion
  complete_words "kerghan configure auto-login=t" -- kerghan configure auto-login = t
  assert_reply "true "
}

@test "matrix cfg-value: edge 13: restart-on-update= offers ask, always and never (both shapes)" {
  source_completion
  complete_words "kerghan configure restart-on-update=" -- kerghan configure restart-on-update =
  assert_reply "ask " "always " "never "
  complete_words "kerghan configure restart-on-update=" -- kerghan configure restart-on-update = ''
  assert_reply "ask " "always " "never "
}

@test "matrix cfg-value: edge 13: restart-on-update=a offers ask and always" {
  source_completion
  complete_words "kerghan configure restart-on-update=a" -- kerghan configure restart-on-update = a
  assert_reply "ask " "always "
}

@test "matrix cfg-free: edge 16: free-form config values are never offered (both shapes)" {
  source_completion
  local key
  for key in port bind image-tag stop-timeout; do
    complete_words "kerghan configure $key=" -- kerghan configure "$key" =
    assert_no_reply
    complete_words "kerghan configure $key=" -- kerghan configure "$key" = ''
    assert_no_reply
  done
}

@test "matrix cfg-free: edges 15, 16: env values are never offered" {
  source_completion
  complete_words "kerghan configure KERGHAN_SECRET_KEY=" -- kerghan configure KERGHAN_SECRET_KEY =
  assert_no_reply
  complete_words "kerghan configure FRONTEND_BASE_URL=" -- kerghan configure FRONTEND_BASE_URL = ''
  assert_no_reply
}

@test "edge 16: KEY=- offers nothing (cfg-free)" {
  source_completion
  complete_words "kerghan configure port=-" -- kerghan configure port = -
  assert_no_reply
}

# --- Never filenames -------------------------------------------------------

@test "matrix top-first: never offers a filename from the current directory" {
  source_completion
  mkdir -p "$TEST_ROOT/pwd"
  : >"$TEST_ROOT/pwd/upfile"
  cd "$TEST_ROOT/pwd"
  complete_line "kerghan up"
  assert_reply "up " "update " "update-env "
}

@test "matrix top-later: never falls back to filenames for an unknown command" {
  source_completion
  mkdir -p "$TEST_ROOT/pwd"
  : >"$TEST_ROOT/pwd/upfile"
  cd "$TEST_ROOT/pwd"
  complete_line "kerghan foo u"
  assert_no_reply
}

@test "edge 2: complete -o nospace -F _kerghan kg makes an alias complete the same" {
  source_completion
  complete -o nospace -F _kerghan kg
  run complete -p kg
  [ "$output" = "complete -o nospace -F _kerghan kg" ]
  complete_line "kg "
  assert_reply "${ALL_COMMANDS[@]}"
}

@test "edge 3: the script uses no bash-4-only or bash-completion constructs" {
  run "$KERGHAN" completion bash
  [ "$status" -eq 0 ]
  local word
  for word in compopt "declare -A" "local -A" mapfile readarray "[[ -v" "local -n" ",,}" \
    _init_completion _get_comp_words_by_ref __ltrim_colon_completions; do
    refute_output_contains "$word"
  done
}
