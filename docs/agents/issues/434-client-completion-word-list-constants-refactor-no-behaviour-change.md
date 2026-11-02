# Issue: Client: completion word-list constants (refactor, no behaviour change)

## Description

Sub-issue of the shell autocomplete Epic (#424). It comes from the word-list decision in #426 and is ordered after #426 and before #429 (`kerghan completion bash`). Spec: [completion.md — Word lists](../specs/auto-complete/completion.md#word-lists), [contracts.md — Sync rule](../specs/auto-complete/contracts.md#sync-rule).

A pure refactor of `standalone/bin/kerghan` with **no behaviour change**. It turns the lists bash completion will generate from (see #426) into client constants, and makes the client itself read them.

### What it adds

- **Four value constants**, one per fixed-value config key, named after the key so the #429 sync tests can map a key to its constant mechanically (`<KEY>` upper-cased, `-` → `_`, plus `_VALUES`):
  - `VARIANT_VALUES="online offline"`
  - `RUNTIME_VALUES="auto sysbox privileged"`
  - `AUTO_LOGIN_VALUES="true false"`
  - `RESTART_ON_UPDATE_VALUES="ask always never"`
- **Validators read the constants.** `valid_variant`, `valid_runtime`, `valid_bool` and `valid_restart_on_update` check membership with the existing `in_list` helper instead of hard-coded `case` patterns. `valid_bool` reads `AUTO_LOGIN_VALUES`, so the env bool keys (`KERGHAN_DEFAULT_USER_ENABLED`, `KERGHAN_DEFAULT_USER_ADMIN`) keep sharing the same check.
- **A join helper** (e.g. `or_list`) renders a constant as human text: the last two words joined with ` or `, the rest with `, ` (`online or offline`, `auto, sysbox or privileged`).
- **Messages built from the constants**, through that helper:
  - `config_expected` for `variant`, `runtime`, `auto-login` and `restart-on-update`;
  - the `load_config` / `config_invalid` calls that pass the same texts as literals today;
  - the env bool-key message in the `configure` validator (`expected true or false`).
- **An env-key constant** holding `FRONTEND_BASE_URL`, the one known env key outside `DEFAULT_ENV_KEYS`. Every code use of the literal switches to it: the `configure` listing, the `configure` validator `case` label, `frontend_base_url_args` (the `up`/`update` injection) and the wizard question. Comments may keep the name in prose.
- **The `BASH_SOURCE` guard** that lets the client be sourced without running `main` is documented in the client header as an internal test contract, next to the bash 3.2 rule.

### Notes

- `--unset` needs no change: `FRONTEND_BASE_URL` can be unset only because it is not in `DEFAULT_ENV_KEYS`; there is no literal in that path.

### Not in scope

- Commands and per-command flags stay as they are (`case` dispatch and parsers). #426 keeps them hand-written in the completion function, guarded by a `kerghan help` cross-check.
- `is_bool_key` (a list of keys, not values) stays as it is.
- Any completion code (#429).
- `CONFIG_KEYS` and `DEFAULT_ENV_KEYS` are already constants and stay unchanged.

## Expected Behavior

- `usage` text, error, warning and hint messages are byte-identical before and after.
- Accepted inputs, exit codes and the order of the `configure` listing don't change.
- The existing bats suite passes unchanged.
- The new constants and the join helper are bash 3.2 compatible: space-separated strings, no associative arrays.
- The constants are internal, not stable contracts, so their names may change (the sync tests change with them).

## Benefits

#429 can generate the completion's config keys, env keys and fixed values from the same data the client validates against. A new value or env key then reaches completion without a second edit.
