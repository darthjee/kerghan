#!/usr/bin/env bats
# Sync rule: the completion's word lists match `kerghan help` and the client's
# constants (docs/agents/specs/auto-complete/completion.md, contracts.md). A PR
# that adds a command, flag, configure key or fixed value without updating the
# completion fails here. Runs on bash 5 and bash 3.2.

load helpers/setup
load helpers/completion

# Accepted by the client, never completed (hidden steps).
EXCLUDED_WORDS="--finish"
# Config keys whose value is typed freely; every other config key has a value constant.
FREE_FORM_KEYS="port bind image-tag stop-timeout"

# client_const NAME - prints the client's constant NAME (empty when unset). The
# client is sourced in a subshell: its BASH_SOURCE guard keeps main from
# running, and its top-level `set -euo pipefail` stays out of the bats shell.
client_const() {
  (
    # shellcheck disable=SC1090
    source "$KERGHAN"
    printf '%s' "${!1-}"
  )
}

# client_has_const NAME - the client defines NAME.
client_has_const() {
  (
    # shellcheck disable=SC1090
    source "$KERGHAN"
    [ -n "${!1+set}" ]
  )
}

# replies - the current COMPREPLY words, trailing space removed, one per line.
replies() {
  local w
  for w in ${COMPREPLY[@]+"${COMPREPLY[@]}"}; do
    printf '%s\n' "${w% }"
  done
}

# compare_sets LEFT_NAME LEFT RIGHT_NAME RIGHT - LEFT and RIGHT (whitespace-
# separated words) are equal sets; prints each word missing from a side as
# `<word>: in LEFT_NAME, not in RIGHT_NAME`.
compare_sets() {
  local left_name="$1" left="$2" right_name="$3" right="$4" w ok=true
  for w in $left; do
    in_words "$w" "$right" || {
      echo "$w: in $left_name, not in $right_name" >&2
      ok=false
    }
  done
  for w in $right; do
    in_words "$w" "$left" || {
      echo "$w: in $right_name, not in $left_name" >&2
      ok=false
    }
  done
  [ "$ok" = "true" ]
}

# in_words WORD LIST
in_words() {
  case " $(echo $2) " in
    *" $1 "*) return 0 ;;
  esac
  return 1
}

# without WORDS EXCLUDED - WORDS minus the EXCLUDED words.
without() {
  local w out=""
  for w in $1; do
    in_words "$w" "$2" || out="$out $w"
  done
  echo "$out"
}

# usage_commands - the command synopsis lines of `kerghan help` (two-space
# indent under Commands:), description cut off.
usage_commands() {
  "$KERGHAN" help | sed -n '/^Commands:/,/^$/p' | grep '^  [^ ]' | while IFS= read -r line; do
    # The description starts at column 35; a longer synopsis has it on the next line.
    if [ "${#line}" -gt 34 ] && [ "${line:32:2}" = "  " ]; then
      line="${line:0:34}"
    fi
    echo "$line"
  done
}

# usage_flags COMMAND - the flags of COMMAND in `kerghan help`: its synopsis
# lines and its "Options for COMMAND:" section, with --[no-]x expanded.
usage_flags() {
  {
    usage_commands | grep "^  $1 "
    "$KERGHAN" help | sed -n "/^Options for $1:/,/^\$/p"
  } | sed 's/--\[no-\]\([a-z-]*\)/--\1 --no-\1/g' |
    grep -oE '(^|[][ ,])--?[a-z][a-z-]*' | sed 's/^[][ ,]//' | sort -u
}

@test "sync usage commands: the top-level words match the usage commands" {
  source_completion
  local usage completion
  usage="$(usage_commands | awk '{ print $1 }' | sort -u)"
  complete_line "kerghan "
  completion="$(replies)"
  compare_sets usage "$(without "$usage" help)" completion "$(without "$completion" "help -h --help")"

  # help, -h and --help are accepted by the client and completed.
  local arg
  for arg in help -h --help; do
    run "$KERGHAN" "$arg"
    [ "$status" -eq 0 ]
    assert_output_contains "Usage: kerghan"
    in_words "$arg" "$completion"
  done
}

@test "sync usage flags: each command's flags match its usage" {
  source_completion
  local cmd usage completion ok=true
  for cmd in $(usage_commands | awk '{ print $1 }' | sort -u); do
    usage="$(usage_flags "$cmd")"
    complete_line "kerghan $cmd -"
    completion="$(replies | grep '^-' || true)"
    compare_sets "usage ($cmd)" "$(without "$usage" "$EXCLUDED_WORDS")" \
      "completion ($cmd)" "$(without "$completion" "$EXCLUDED_WORDS")" || ok=false
  done
  [ "$ok" = "true" ]
}

@test "sync usage keys: the usage settings match the offered keys" {
  source_completion
  local usage completion config env expected_env
  usage="$("$KERGHAN" help | sed -n '/^Settings are read from/,/^[^ ]/p' |
    sed -n 's/^  \([a-z][a-z-]*\)=.*/\1/p')"
  complete_line "kerghan configure "
  completion="$(replies)"
  config="$(echo "$completion" | sed -n 's/^\([a-z][a-z-]*\)=$/\1/p')"
  env="$(echo "$completion" | sed -n 's/^\([A-Z][A-Z0-9_]*\)=$/\1/p')"
  compare_sets usage "$usage" completion "$config"
  expected_env="$(client_const DEFAULT_ENV_KEYS) $(client_const FRONTEND_BASE_URL_KEY)"
  compare_sets "DEFAULT_ENV_KEYS + FRONTEND_BASE_URL_KEY" "$expected_env" completion "$env"
}

@test "sync generated lists: keys, --unset keys and values come from the client constants" {
  source_completion
  local config_keys env_keys frontend key name values completion
  config_keys="$(client_const CONFIG_KEYS)"
  env_keys="$(client_const DEFAULT_ENV_KEYS)"
  frontend="$(client_const FRONTEND_BASE_URL_KEY)"
  [ -n "$config_keys" ]
  [ -n "$env_keys" ]
  [ "$frontend" = "FRONTEND_BASE_URL" ]

  complete_line "kerghan configure "
  completion="$(replies | sed -n 's/=$//p')"
  compare_sets "CONFIG_KEYS + DEFAULT_ENV_KEYS + FRONTEND_BASE_URL_KEY" \
    "$config_keys $env_keys $frontend" completion "$completion"

  complete_line "kerghan configure --unset "
  completion="$(replies)"
  compare_sets "CONFIG_KEYS + FRONTEND_BASE_URL_KEY" "$config_keys $frontend" \
    "completion (--unset)" "$completion"

  for key in $config_keys; do
    name="$(echo "$key" | tr 'a-z-' 'A-Z_')_VALUES"
    if client_has_const "$name"; then
      values="$(client_const "$name")"
      complete_words "kerghan configure $key=" -- kerghan configure "$key" =
      compare_sets "$name values" "$values" "completion ($key=)" "$(replies)"
    fi
  done
}

@test "sync classification: every config key is free-form or has a value constant" {
  local key name has free ok=true
  for key in $(client_const CONFIG_KEYS); do
    name="$(echo "$key" | tr 'a-z-' 'A-Z_')_VALUES"
    has=false
    free=false
    if client_has_const "$name"; then
      has=true
    fi
    if in_words "$key" "$FREE_FORM_KEYS"; then
      free=true
    fi
    if [ "$has" = "$free" ]; then
      echo "$key: in FREE_FORM_KEYS: $free, has $name: $has (exactly one expected)" >&2
      ok=false
    fi
  done
  [ "$ok" = "true" ]
}
