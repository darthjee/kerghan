# Standalone Plan: Client: completion word-list constants (refactor, no behaviour change)

Main plan: [plan.md](plan.md)

## Overview
A refactor of `standalone/bin/kerghan` that changes no behaviour. It turns the fixed config values and the extra known env key into constants that #429 (`kerghan completion bash`) can generate its word lists from. The client's own validators and messages read the same constants, so the client and completion have one source.

## Context
- Spec: [completion.md — Word lists](../../specs/auto-complete/completion.md#word-lists), [contracts.md — Sync rule](../../specs/auto-complete/contracts.md#sync-rule).
- Today the values live in `case` patterns (`valid_variant`, `valid_runtime`, `valid_bool`, `valid_restart_on_update`, around lines 173–235). The human texts are spelled out twice: in `config_expected` (~line 613) and in the `load_config` `config_invalid` calls (~lines 295–327). The env bool-key check in the `configure` validator (~line 1074) has its own `expected true or false` text.
- `FRONTEND_BASE_URL` appears as a literal in `frontend_base_url_args` (~439–440), the `configure` validator `case` label (~1085), the `configure` listing (~2558, ~2563) and the wizard (~2948–2953).
- The client already ends with `if [ "${BASH_SOURCE[0]}" = "$0" ]; then main "$@"; fi` (~line 3057).
- Must stay bash 3.2 compatible (header rule): space-separated strings, no associative arrays.

## Steps

- [01 — Value constants, validators and messages](standalone/01-value-constants.md)
- [02 — FRONTEND_BASE_URL env-key constant](standalone/02-env-key-constant.md)
- [03 — Document the BASH_SOURCE guard](standalone/03-document-bash-source-guard.md)

## CI Checks
- `standalone`: `docker-compose run --rm standalone_tests` (CI job: `standalone_tests`, runs `bats standalone/test`)

## Notes
- No test changes are expected: the existing bats suite must pass **unchanged**. It is the proof that the output is byte-identical. Don't edit an existing test to make it pass. If one fails, the refactor changed behaviour.
- The constants are internal, not contracts (contracts.md). Keep the names derivable from the key anyway (`<KEY>` upper-cased, `-` → `_`, plus `_VALUES`) so the #429 sync tests can find them mechanically.
- Out of scope: commands/flags `case` dispatch, `is_bool_key`, `CONFIG_KEYS`, `DEFAULT_ENV_KEYS`, and any completion code (#429).
