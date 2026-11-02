# Issue: Specs: autocomplete — single source of truth for completion word lists

## Description

Spec-enhancement sub-issue of the shell autocomplete Epic (#424). It follows the specs sub-issue (`docs/agents/specs/auto-complete/` must exist) and comes before the completion matrix (#427), testing-strategy (#428) and client-constants refactor (#434) sub-issues.

Decide where the completion's word lists come from, and write that decision into the spec (`completion.md`, plus `contracts.md`/`security.md` when they are affected).

The word lists are: the command names; each command's flags; the `configure` config keys; the static `DEFAULT_ENV_KEYS` names; and the fixed values (`variant` → `online|offline`, `runtime` → `auto|sysbox|privileged`, `auto-login` → `true|false`, `restart-on-update` → `ask|always|never`).

### Constraints (from #424)

- The emitted script is fixed text at runtime. It never interpolates environment variables, config values, `$HOME` or paths. Generating it from the client's own **constants** is allowed; reading config or env files is not.
- No subprocess and no file read on TAB.
- bash 3.2 compatible: no associative arrays.
- The sync rule (any PR that changes a command, flag, key or fixed value updates completion in the same PR) must be enforceable by a test.

### Decision: source of each word list

A mix: generate what the client holds (or will hold) as data, hand-write what only exists as `case` code.

| List | Source | Why |
|------|--------|-----|
| `configure` config keys | **Generated** from `CONFIG_KEYS` | Already a constant. |
| Env keys | **Generated** from `DEFAULT_ENV_KEYS` plus a new constant holding `FRONTEND_BASE_URL` (#434) | Mostly data already. |
| Fixed values | **Generated** from four new value constants (#434); the `valid_*` validators and their messages read the same constants | Small, mechanical refactor; one source for validation and completion. |
| Commands | **Hand-written** in `_kerghan`, guarded by the `kerghan help` cross-check | A `case` pattern can't take its alternatives from a variable, so a constant wouldn't drive dispatch. |
| Per-command flags | **Hand-written**, same guard, plus the exclusion list (`--finish`) | Same reason; would mean reworking every `cmd_*` parser for little gain. |

The `--unset` list is derived from the generated lists (edge case 5).

**Rejected:**

- **Generate everything:** needs rewriting the `main` dispatch and every `cmd_*` parser, and still leaves the `case` patterns as a second copy of each list.
- **Hand-write everything:** gives up the guarantee the existing constants already offer for free.

"Generated" means `kerghan completion bash` prints the lists from the client's own constants. The script remains fixed text for a given client version: never built from env, config, `$HOME` or paths. `security.md` §5 is reworded to say so.

The client refactor (the value constants, the `FRONTEND_BASE_URL` constant, and documenting the `BASH_SOURCE` guard) is **#434**, a sub-issue of #424 ordered after #426 and before #429.

### Testing strategy (what the sync tests check; #428 defines how)

- **Generated lists:** a test sources the client (relying on the `BASH_SOURCE` guard) and checks that completion offers exactly `CONFIG_KEYS`, `DEFAULT_ENV_KEYS` plus the `FRONTEND_BASE_URL` constant, and each value constant.
- **Hand-written lists:** the `kerghan help` cross-check already defined in #428 checks commands and synopsis flags (with `--[no-]x` expanded and aliases counted), minus the commented exclusion list.
- **Classification:** every `CONFIG_KEYS` entry is either in `FREE_FORM_KEYS` or has a value constant (edge case 6).
- Failures name the word and the side it is missing from.

### Scope

**In scope (spec only):**

- Decide the source of each word list (commands, per-command flags, `configure` config keys, env keys, fixed values) and write it into `completion.md#word-lists`, with the rejected alternatives and why.
- Decide how the sync rule is enforced and write it into `contracts.md#sync-rule`.
- Update `security.md` §5 ("fixed text") if generating from constants changes its wording (e.g. "fixed for a given client version: built from the client's constants, never from env, config or paths").
- Name the sync test(s) in the "Required tests" of the files touched (what they check; #428 defines how).
- Remove the two `Open — settled by #426` markers and update the README open-items table.

**Out of scope:**

- Any change to `standalone/bin/kerghan`. If the decision needs new client constants (e.g. a command list, value lists, per-command flag lists) and the client's `case` dispatch / `valid_*` functions to read from them, that refactor goes to a **separate sub-issue of #424**, ordered before #429: a pure client refactor with no behaviour change. #426 only states what that refactor must provide.
- The per-position table and the no-trailing-space mechanism (#427).
- The test harness and the test files (#428).
- zsh and fish.

### Edge cases

Words where the client and completion legitimately differ, and shapes any generated or compared list must handle. Whatever the source chosen, the spec states:

1. **Hidden words** (`update --finish`): accepted by the client, never completed. They live in one explicit, commented **exclusion list** (only `--finish` today). The sync check treats them as known and intentionally not completed; a new hidden step must be added there on purpose or the check fails.
2. **Aliases** (`-p` / `--port`, `help` / `-h` / `--help`): both forms are completed, so both are in the lists as plain words. Grouping aliases ("seen one, hide both", edge 9) is #427's per-position logic, not part of the word-list source.
3. **`--[no-]x` pairs:** the lists hold both expanded words (`--auto-login`, `--no-auto-login`, `--restart`, `--no-restart`). Any comparison with `usage` expands the bracket form.
4. **Env keys:** completed env keys are `DEFAULT_ENV_KEYS` plus `FRONTEND_BASE_URL`. `CLIENT_MANAGED_KEYS` (`KERGHAN_DEFAULT_USER_ALWAYS_AUTHENTICATED`, `KERGHAN_DEFAULT_USER_ALLOWED_IPS`) are refused by `configure` and are explicitly never offered. Whether `FRONTEND_BASE_URL` becomes a client constant is decided with the sources.
5. **Derived lists:** the `--unset` list (config keys plus `FRONTEND_BASE_URL`, no `DEFAULT_ENV_KEYS`) is derived from the same lists, never kept as a separate list, so it can't drift on its own.
6. **Fixed values vs free-form keys:** every `CONFIG_KEYS` entry is either in a commented `FREE_FORM_KEYS` list kept in the sync test (`port`, `bind`, `image-tag`, `stop-timeout`) or has a completion value set — never both, never neither. A new config key therefore fails the check until it is classified. Rejected: detecting enum-like validators by parsing the `valid_*` `case` patterns (brittle, breaks on any rewrite of a validator); leaving it to review (a new key would silently complete to nothing).
7. **Positional arguments** (`compose <args>`, `update [VERSION]`, `configure [KEY]` as a bare read): not word-list entries; covered by "Never completed" in `completion.md`.
8. **Ordering:** lists are compared as sets; order is not significant (bash sorts `COMPREPLY` for display).

### Backward compatibility

1. **The sync rule** (`contracts.md#sync-rule`) is unchanged; #426 only adds how it is enforced, through tests — an internal mechanism, not user-facing.
2. **New client constants are not contracts.** Any list the refactor sub-issue adds is internal to `standalone/bin/kerghan` (nothing outside the repo sources the client); its names may change and the sync test follows them. `contracts.md` says so explicitly.
3. **The completion script's content** still "can change freely" between versions. With `eval "$(kerghan completion bash)"` it always matches the installed client; with the installed file (#430), `kerghan update` re-runs the installer, which rewrites it. An already-open shell keeps the old function until a new shell starts, as with any completion.
4. **The refactor sub-issue makes no behaviour change:** `usage` text, error and hint messages stay byte-identical (e.g. `config_expected`'s `online or offline`, even if built from a value list), as do accepted inputs, exit codes and the `CONFIG_KEYS` listing order. The existing bats suite passes unchanged.
5. **The `BASH_SOURCE` guard** (the client can be sourced without running `main`) becomes an internal test contract the sync test relies on; it is documented next to the bash 3.2 rule in the client header. Not user-facing.
6. **Older clients:** `kerghan update` to an older version brings that version's completion (or none, before #429); there is no cross-version mix.

## Expected Behavior

- The spec states the chosen source for each word list, with the rejected alternatives and why.
- It names the test that keeps each list in sync with the client: the source-the-client check for generated lists, the `kerghan help` cross-check for hand-written ones, and the `FREE_FORM_KEYS` classification check.
- `contracts.md#sync-rule` states how the rule is enforced and that the new client constants are not contracts.
- `security.md` §5 says the script is fixed text for a given client version.
- The two `Open — settled by #426` markers are removed, the README open-items table is updated, and #434 is listed in the README's sub-issue table and ordering (#425 → #426 → #427 → #428 → #434 → #429 → …).

## Benefits

Completion can't silently drift from the client as commands, flags and keys are added.
