# Standalone: client completion (`kerghan completion bash`)

Part of [Standalone Distribution](../standalone.md). Defines bash tab completion for the
`kerghan` client: the `kerghan completion <shell>` command that prints the completion script,
what that script completes and never completes, the `install.sh` step that installs it, its
performance and security rules, the **stable contracts** every future release must keep and how
all of it is tested. Product decision: epic #424 (the "edge case", "backward compatibility item"
and "performance & security item" numbers below are #424's). Code: `standalone/bin/kerghan`
(`cmd_completion`, `completion_bash_script` and the word-list constants) and
`standalone/install.sh` (`install_completion`). Tests: `standalone/test/completion.bats`,
`completion_command.bats`, `completion_safety.bats`, `completion_sync.bats` and
`install_completion.bats`, plus `helpers/completion.bash`.

- [Overview and scope](#overview-and-scope)
- [`kerghan completion <shell>`](#kerghan-completion-shell)
- [What is completed](#what-is-completed)
- [Installer setup](#installer-setup)
- [Performance and security](#performance-and-security)
- [Stable contracts](#stable-contracts)
- [Testing](#testing)

## Overview and scope

The `kerghan` client (`standalone/bin/kerghan`) has bash completion for its commands, their
flags, the keys `configure` accepts and the values those keys take. It is delivered through two
channels:

1. **`kerghan completion bash`** prints the completion script on stdout, to be loaded with
   `eval "$(kerghan completion bash)"` (see
   [`kerghan completion <shell>`](#kerghan-completion-shell)). The script is built into the
   client, so it always matches the installed version, and `kerghan update` keeps it current.
2. **`install.sh`** writes that same output into the user-level bash-completion directory,
   where bash-completion v2 lazy-loads it on the first `kerghan <TAB>` (see
   [Installer setup](#installer-setup)). No rc-file edit and no sudo.

What the script completes, and what it never completes, is defined in
[What is completed](#what-is-completed).

### Scope

In scope:

- **Shell:** bash only, including bash 3.2 (macOS).
- **What is completed:** command names (and `help` / `-h` / `--help` at the top level), each
  command's flags, `configure` keys (the config keys, the static `DEFAULT_ENV_KEYS` names and
  `FRONTEND_BASE_URL`),
  and the values of the keys with a fixed set: `variant`, `runtime`, `auto-login`,
  `restart-on-update` ([What is completed](#what-is-completed)).
- **`kerghan completion <shell>`**: its shape, streams and error cases
  ([`kerghan completion <shell>`](#kerghan-completion-shell)).
- **The `install.sh` completion step**: target path, content, hint, non-fatal handling, opt-out,
  overwrite and downgrade ([Installer setup](#installer-setup)).
- **The stable contracts** the feature creates ([Stable contracts](#stable-contracts)) and its
  performance and security rules ([Performance and security](#performance-and-security)).

Out of scope (from #424):

- zsh and fish: separate future Epics. The shell is a required argument of
  `kerghan completion <shell>`, so each can add its shell without changing the bash contract
  (see [`kerghan completion bash`](#kerghan-completion-bash)).
- Completing `update [VERSION]` with release versions, which would need a network call.
- Passing `compose …` arguments through to docker compose's own completion.
- Completion for the `vault` CLI.
- Dynamic lookups (Docker, Vault, GitHub, config or env files) during completion.
- Windows / PowerShell.
- Uninstalling the completion file: there is no uninstaller; its path is documented in
  [Target](#target).

### Decisions summary

- **[`kerghan completion <shell>`](#kerghan-completion-shell):** `bash` the only supported
  shell; the script goes to stdout with exit `0`, errors to stderr only with a non-zero exit; no
  side effects.
- **[What is completed](#what-is-completed):** one `_kerghan` function registered for `kerghan`
  with `-o nospace`, adding a trailing space to every candidate except `KEY=`; an exact
  per-position table;
  commands, flags, `configure` keys and fixed values are completed; free-form values,
  versions, passthrough arguments and hidden steps never are; never a fallback to filenames;
  edge cases 1–17 as behaviour; bash 3.2 compatible; config keys, env keys and fixed values
  generated from the client's constants, commands and flags hand-written, all guarded by sync
  tests.
- **[Installer setup](#installer-setup):** `install.sh` writes the output of the just-installed
  client into
  `${BASH_COMPLETION_USER_DIR:-${XDG_DATA_HOME:-$HOME/.local/share}/bash-completion}/completions/kerghan`
  through a temp file and `mv -f`; prints a `hint:` without `bash-completion`; never fatal;
  opt out with `KERGHAN_COMPLETION=false`; overwrites; a downgrade leaves the file behind.
- **[Performance and security](#performance-and-security):** TAB is pure bash; the emitted
  script is fixed text and leaves the user's shell untouched; no secrets; safe installer writes;
  the exact binary.
- **[Stable contracts](#stable-contracts):** `kerghan completion bash`, `_kerghan`,
  `KERGHAN_COMPLETION=false` and the completion file path are stable; the installer's `update`
  contract is unchanged; the sync rule, enforced by the sync tests; the client's constants
  are not contracts.

How every rule is tested (harness, bash 3.2 service, file layout, naming) is in
[Testing](#testing); each section lists its concrete cases under "Required tests".

## `kerghan completion <shell>`

The client command that prints the completion script.

### Shape

```
kerghan completion <shell>
```

- **`<shell>` is required.** `bash` is the only supported value. zsh and fish are later Epics;
  keeping the shell as an argument lets each add its value without changing this contract (see
  [`kerghan completion bash`](#kerghan-completion-bash)).
- **No options.** `completion` takes no flags and no other argument.
- **Dispatched like any other command** from `main`'s `case`. `main` has no global startup
  checks today, so nothing runs before it (no config read, no Docker check).
- Loaded with:

  ```bash
  eval "$(kerghan completion bash)"
  ```

  or installed as a file by `install.sh` (see [Installer setup](#installer-setup)).

### Output and streams

- **Success:** the completion script (see [What is completed](#what-is-completed)) goes to **stdout
  only**, and the exit code is `0`. Nothing else is printed on either stream.
- **Error:** a usage error through the client's `usage_error`: `kerghan: error: <message>`
  followed by the full `usage` text, both on **stderr only**, nothing on stdout, exit `2`.
- **Why stdout stays clean on error** (edge case 19): an rc line
  `eval "$(kerghan completion bash)"` must never evaluate an error message. After a downgrade to
  a client without `completion`, that client prints its own usage error on stderr, so the
  `eval` gets an empty string. Every client that has `completion` keeps the same split for its
  own errors.
- **Consequence after a downgrade:** the older client's usage error (about 45 lines of `usage`)
  then prints on stderr in every new shell. This is accepted; the user docs may show the rc line
  as `eval "$(kerghan completion bash 2>/dev/null)"` to silence it.

### Error cases

Edge case 18. Each is a usage error (`usage_error`: message and usage on stderr, exit `2`):

| Call | Result |
|------|--------|
| `kerghan completion` (no shell) | usage error |
| `kerghan completion zsh`, `fish`, or any other value | usage error naming the shell and the supported ones (e.g. `kerghan: error: unsupported shell 'zsh' (supported: bash)`) |
| `kerghan completion -x` (an option-like first word) | usage error naming the option |
| `kerghan completion bash extra` (extra arguments) | usage error |

These follow the client's existing usage-error convention: `usage_error` prints
`kerghan: error: <message>` and the `usage` text on stderr and exits `2`, like every other
command's usage errors. The exact messages are in
[Messages and exit codes](#messages-and-exit-codes).

#### Messages and exit codes

**`usage` line,** in the `Commands:` block between `wizard` and `version`, in the same
two-column style (the description starts at column 35, like the other lines):

```
  completion bash                 print the bash completion script (load it with: eval "$(kerghan completion bash)")
```

There is no "Options for completion" section.

**Error messages,** all through `usage_error`, in the client's quoted style. Each call exits
`2`, prints the line below then the full `usage` text on stderr, and prints nothing on stdout.

| Call | stderr first line |
|------|-------------------|
| `kerghan completion` | `kerghan: error: missing shell (supported: bash)` |
| `kerghan completion zsh` (any unsupported value) | `kerghan: error: unsupported shell 'zsh' (supported: bash)` |
| `kerghan completion -x` (an option-like first word) | `kerghan: error: unknown option '-x'` |
| `kerghan completion bash extra` | `kerghan: error: unexpected argument 'extra'` |

- **Order of checks:** the first argument is checked first (missing, then option-like, then
  unsupported), then extra arguments. So `kerghan completion zsh extra` reports the unsupported
  shell, and `kerghan completion -x extra` the unknown option.
- **Option-like** means a first word starting with `-` (`-x`, `--help`).
- The quoted value is the word as typed, so `kerghan completion Bash` reports
  `unsupported shell 'Bash' (supported: bash)`.

### No side effects

Performance & security item 2. `kerghan completion bash` prints the script and exits. It never:

- reads `~/.kerghan/config` or `kerghan.env`;
- creates `~/.kerghan` or anything under it;
- calls Docker, Vault or the network;
- depends on the current directory or on environment variables for its output (see
  [Fixed text](#fixed-text)).

This matters because the `eval` route runs it on every new shell.

### `usage`

The `usage` text gains a `completion` line among the commands (backward compatibility item 1).
Bats tests that check the full usage text are updated with it. The exact line is in
[Messages and exit codes](#messages-and-exit-codes).

### Required tests

All in `completion_command.bats` (harness and naming: [Testing](#testing)). Each
case runs the client with the stubs from `helpers/setup.bash`. "Usage" means the full `usage`
text, as printed by `kerghan help`.

| Label | Input | Expected |
|-------|-------|----------|
| `contract completion bash` | `kerghan completion bash` | exit `0`; stdout is the completion script; stderr empty |
| `contract _kerghan` | source the output of `kerghan completion bash` | `_kerghan` is a function; `complete -p kerghan` prints `complete -o nospace -F _kerghan kerghan` |
| error: missing shell | `kerghan completion` | exit `2`; stdout empty; stderr is `kerghan: error: missing shell (supported: bash)` then the usage |
| error: unsupported shell | `kerghan completion zsh` | exit `2`; stdout empty; stderr is `kerghan: error: unsupported shell 'zsh' (supported: bash)` then the usage |
| error: unsupported shell | `kerghan completion fish` | exit `2`; stdout empty; stderr is `kerghan: error: unsupported shell 'fish' (supported: bash)` then the usage |
| error: quoted as typed | `kerghan completion Bash` | exit `2`; stdout empty; stderr is `kerghan: error: unsupported shell 'Bash' (supported: bash)` then the usage |
| error: unknown option | `kerghan completion -x` | exit `2`; stdout empty; stderr is `kerghan: error: unknown option '-x'` then the usage |
| error: unknown option | `kerghan completion --help` | exit `2`; stdout empty; stderr is `kerghan: error: unknown option '--help'` then the usage |
| error: extra argument | `kerghan completion bash extra` | exit `2`; stdout empty; stderr is `kerghan: error: unexpected argument 'extra'` then the usage |
| error: order of checks | `kerghan completion zsh extra` | exit `2`; stdout empty; stderr is `kerghan: error: unsupported shell 'zsh' (supported: bash)` then the usage |
| error: order of checks | `kerghan completion -x extra` | exit `2`; stdout empty; stderr is `kerghan: error: unknown option '-x'` then the usage |
| usage line | `kerghan help` | contains the exact `completion bash` line from [Messages and exit codes](#messages-and-exit-codes), after the `wizard` line and before the `version` line |
| no side effects | `kerghan completion bash`, with `STUB_LOG` set and `find "$HOME"` taken before | `STUB_LOG` is empty (no `docker`, `vault` or `curl`); `find "$HOME"` is identical afterwards; `~/.kerghan` does not exist |

Existing bats tests that compare the full usage text are updated with the new line in the same
PR. The fixed-text and no-secret-leak cases for the generator are in
[performance and security required tests](#required-tests-3); the `kg` alias case is in
[stable contracts required tests](#required-tests-4).

## What is completed

What the bash completion script offers, per command and position.

### Registration

- The script defines one completion function, **`_kerghan`**, and registers it with
  `complete -o nospace -F _kerghan kerghan`. Helpers, if any, are prefixed `_kerghan_`.
- `_kerghan` is a stable name (see [`_kerghan`](#_kerghan)).
- **`-o nospace` is the only option allowed.** The registration never uses `-o default`,
  `-o bashdefault` or `-o filenames`: completion never falls back to filenames (see
  [Never completed](#never-completed)).

#### Trailing space

bash 3.2 has no `compopt`, so the trailing space can't be switched per word. The strategy is
fixed:

- bash adds no space by itself (`-o nospace`).
- `_kerghan` appends a space to **every candidate except `KEY=` candidates** (`port=`,
  `KERGHAN_SECRET_KEY=`, …), so a command, a flag, a fixed value or a bare `--unset` key is
  followed by a space, and the value of a `KEY=` follows at once.
- When a single candidate remains, bash inserts it as is, so the space must already be part of
  the word in `COMPREPLY`.

### Completed words

Word lists follow the client today (`standalone/bin/kerghan`).

#### Top level

`kerghan <TAB>` offers every command name:

`up`, `down`, `logs`, `status`, `compose`, `reset`, `update`, `update-env`, `configure`,
`wizard`, `version`, `completion`, plus `help`, `-h` and `--help`.

#### Per command

A summary. The exact candidates at each position, with the flags already on the line filtered
out, are in the [per-position table](#per-position-table).

| Command | Offered |
|---------|---------|
| `up` | `--offline`, `-p`, `--port`, `--auto-login`, `--no-auto-login`, `--bind`, `-f` |
| `logs` | `-f` |
| `update` | `--force`, `--yes`, `--restart`, `--no-restart` |
| `configure` | see [`configure`](#configure) |
| `wizard` | `--advanced` |
| `completion` | `bash` |
| `down`, `status`, `compose`, `reset`, `update-env`, `version`, `help` | nothing |

#### `configure`

`configure` takes `--show-secrets`, `--force`, `--unset KEY`, `KEY=VALUE`, `KEY=-` and a bare
`KEY` (print one setting). The script offers:

- **Flags:** `--show-secrets`, `--force`, `--unset`.
- **Config keys, with `=` attached and no trailing space:** `port=`, `variant=`, `runtime=`,
  `stop-timeout=`, `image-tag=`, `auto-login=`, `bind=`, `restart-on-update=`. The value can then
  be typed or completed right away.
- **Env keys** (uppercase, written to `kerghan.env`), with `=` attached: the names in the
  client's static `DEFAULT_ENV_KEYS` constant (`KERGHAN_SECRET_KEY`, `KERGHAN_INTEGRATIONS_KEY`,
  `KERGHAN_DEFAULT_USER_*`), plus `FRONTEND_BASE_URL`, the one known env key outside that
  constant (`configure` lists, validates and unsets it, and the wizard asks for it).
- **Fixed values after `KEY=`:**

  | Key | Values |
  |-----|--------|
  | `variant` | `online`, `offline` |
  | `runtime` | `auto`, `sysbox`, `privileged` |
  | `auto-login` | `true`, `false` |
  | `restart-on-update` | `ask`, `always`, `never` |

- **After `--unset`:** bare key names, with no `=`: the config keys and `FRONTEND_BASE_URL`.
  The `DEFAULT_ENV_KEYS` names are not offered: `configure` refuses to unset them, because
  `kerghan up` and `kerghan update-env` would generate them again.

#### Word lists

A mix: what the client holds as data is generated, what only exists as `case` code is
hand-written.

| List | Source | Why |
|------|--------|-----|
| `configure` config keys | **Generated** from `CONFIG_KEYS` | Already a constant. |
| Env keys | **Generated** from `DEFAULT_ENV_KEYS` plus a constant holding `FRONTEND_BASE_URL` | Mostly data already. |
| Fixed values | **Generated** from four value constants, one per key | The `valid_*` validators and their messages read the same constants: one source for validation and completion. |
| Commands | **Hand-written** in `_kerghan` | A `case` pattern can't take its alternatives from a variable, so a constant wouldn't drive the `main` dispatch. |
| Per-command flags | **Hand-written** in `_kerghan` | Same reason: each `cmd_*` parser matches its flags in a `case`. |

- **"Generated"** means `kerghan completion bash` prints the lists from the client's own
  constants. The script is still fixed text for a given client version: never built from
  environment variables, config, `$HOME` or paths (see [Fixed text](#fixed-text)).
- **Hand-written** lists are guarded by the `kerghan help` cross-check (see
  [Required tests](#required-tests-1)).
- **The `--unset` list** (the config keys plus `FRONTEND_BASE_URL`, no `DEFAULT_ENV_KEYS`) is
  derived from the generated lists, never kept as a separate list, so it can't drift on its own.
- The four value constants and the `FRONTEND_BASE_URL` constant exist for this: they are the
  single source for both validation and completion. The client header documents the
  `BASH_SOURCE` guard the sync tests rely on (see [Sync rule](#sync-rule)).

**Rejected:**

- **Generate everything:** needs rewriting the `main` dispatch and every `cmd_*` parser, and the
  `case` patterns would still be a second copy of each list.
- **Hand-write everything:** gives up the guarantee the existing constants already give for
  free.

**Words outside the lists:**

1. **Hidden words** (`update --finish`) are accepted by the client and never completed. They
   live in one explicit, commented **exclusion list** (only `--finish` today). The sync check
   treats them as known and intentionally not completed; a new hidden step must be added there
   on purpose or the check fails.
2. **Aliases** (`-p` / `--port`, `help` / `-h` / `--help`): both forms are completed, so both
   are plain words in the lists. Grouping them (edge case 9) is the
   [per-position table](#per-position-table)'s job.
3. **`--[no-]x` pairs** are stored as both expanded words (`--auto-login`, `--no-auto-login`,
   `--restart`, `--no-restart`).
4. **`CLIENT_MANAGED_KEYS`** (`KERGHAN_DEFAULT_USER_ALWAYS_AUTHENTICATED`,
   `KERGHAN_DEFAULT_USER_ALLOWED_IPS`) are refused by `configure` and never offered.
5. **Positional arguments** (`compose <args>`, `update [VERSION]`, a bare `configure KEY`) are
   not list entries; see [Never completed](#never-completed).
6. **Fixed values vs free-form keys:** every `CONFIG_KEYS` entry is either in a commented
   `FREE_FORM_KEYS` list kept in the sync test (`port`, `bind`, `image-tag`, `stop-timeout`) or
   has a value constant: never both, never neither. A new config key fails the check until it
   is classified. Rejected: detecting enum-like validators by parsing the `valid_*` `case`
   patterns (brittle) and leaving it to review (a new key would silently complete to nothing).
7. **Ordering:** lists are compared as sets; order is not significant (bash sorts `COMPREPLY`
   for display).

#### Per-position table

The exact candidates for every command and cursor position. It is the reference the script and
its tests follow; [Per command](#per-command) and [`configure`](#configure) are the summary.

**Terms:**

- **On the line:** the words between the command and the end of the line, **other than the
  word being completed**.
- **Context:** what decides the row: the word position, the previous word, or the `KEY=` prefix
  of the current word, rebuilt across the `=` word break (edge case 13).
- **Trailing space:** every candidate ends with a space except `KEY=` candidates (see
  [Trailing space](#trailing-space)). "Nothing" means `COMPREPLY` is empty, with no filename
  fallback.
- **Filtering** keeps the candidates that start with the current word, as usual.

Each row has a **label** (first column), unique across the three tables. Labels are stable once
tests cite them (`@test "matrix <label>: …"`, see [Testing](#testing)).

##### Top level, by position

| Label | Context | Candidates |
|-------|---------|------------|
| `top-first` | First word after `kerghan` | `up`, `down`, `logs`, `status`, `compose`, `reset`, `update`, `update-env`, `configure`, `wizard`, `version`, `completion`, `help`, `-h`, `--help` |
| `top-later` | Any later word, when the first word is not a command below (`kerghan foo …`, `kerghan -h …`, `kerghan --help …`) | nothing |

##### Commands, by position

| Label | Command | Context | Candidates |
|-------|---------|---------|------------|
| `up-flag-arg` | `up` | previous word is `-p`, `--port` or `--bind` | nothing; the current word is never read as a flag |
| `up-flags` | `up` | any other position | `--offline`, `-p`, `--port`, `--auto-login`, `--no-auto-login`, `--bind`, `-f`, minus the flags on the line; `-p` and `--port` count as one; once `--auto-login` or `--no-auto-login` is on the line, neither is offered |
| `logs` | `logs` | any position | `-f` if it is not on the line; otherwise nothing |
| `update` | `update` | any position | `--force`, `--yes`, `--restart`, `--no-restart`, minus the flags on the line; once `--restart` or `--no-restart` is on the line, neither is offered; a `VERSION` on the line changes nothing; never a version, never `--finish` |
| `wizard` | `wizard` | any position | `--advanced` if it is not on the line; otherwise nothing |
| `completion-first` | `completion` | first argument | `bash` |
| `completion-later` | `completion` | any later argument | nothing |
| `no-args` | `down`, `status`, `compose`, `reset`, `update-env`, `version`, `help` | any position | nothing |

When reading what is on the line for `up`, the word after `-p`, `--port` or `--bind` is that
flag's argument, never a flag (edge case 8).

##### `configure`, by position

**Lists** (sources: [Word lists](#word-lists)):

- **Config keys:** `port`, `variant`, `runtime`, `stop-timeout`, `image-tag`, `auto-login`,
  `bind`, `restart-on-update`.
- **Env keys:** the `DEFAULT_ENV_KEYS` names and `FRONTEND_BASE_URL`.
- **`--unset` keys:** the config keys and `FRONTEND_BASE_URL`.
- **Keys on the line:** every `KEY` written as `KEY=…` (including `KEY=-`), and every word right
  after an `--unset`.

**State of the line:**

- **A write** is on the line when it holds a `KEY=…`, a `KEY=-` or an `--unset`.
- **`--show-secrets` mode** is on when `--show-secrets` is on the line.

| Label | Context | Candidates |
|-------|---------|------------|
| `cfg-unset` | previous word is `--unset` | the `--unset` keys, bare (no `=`, with a trailing space), minus the keys on the line; never a `DEFAULT_ENV_KEYS` name |
| `cfg-value` | current word is `KEY=` or `KEY=<partial>` (also when bash split it into `KEY`, `=`, `<partial>`), `KEY` one of `variant`, `runtime`, `auto-login`, `restart-on-update` | that key's fixed values (see [`configure`](#configure)), with a trailing space |
| `cfg-free` | current word is `KEY=…` for any other key (free-form config key, env key), or `KEY=-` | nothing |
| `cfg-show-secrets` | any other position, `--show-secrets` mode | nothing |
| `cfg-other` | any other position, otherwise | the flags and the keys below, together |

At "any other position, otherwise":

- **Flags:**
  - `--show-secrets`, unless a write or `--force` is on the line;
  - `--force`, unless it is on the line;
  - `--unset`, always (it can repeat).
- **Keys:** every config key and env key as `KEY=` (no trailing space), minus the keys on the
  line.
- **Never:** a bare `KEY` (print one setting). Reading one key is typed by hand.

A `KEY=-` on the line leaves `KEY=` candidates offered: only one key can be read hidden per
call, but the value of the next key is typed, not `-`.

These rules mirror `configure`'s own usage errors: completion never offers a word that turns the
line into a usage error (the same reasoning as edge case 10).

##### Edge cases in the table

| Edge case | Where | Rows |
|-----------|-------|------|
| 4. Unknown command | [Top level](#top-level-by-position), "any later word" | `top-later` |
| 5. Nothing left to offer | [Commands](#commands-by-position), last row | `no-args` |
| 6. `compose`, `logs` beyond `-f` | [Commands](#commands-by-position): `logs` row and last row | `logs`, `no-args` |
| 7. `update VERSION` | `update` row | `update` |
| 8. Free-form flag arguments | `up`'s first row, and the note under the table | `up-flag-arg` |
| 9. Flags already on the line, aliases | the "minus the flags on the line" rule in each row; `--unset` in [`configure`](#configure-by-position) | `up-flags`, `logs`, `update`, `wizard`, `cfg-other` |
| 10. Mutually exclusive pairs | `up` and `update` rows | `up-flags`, `update` |
| 11. Hidden steps | `update` row | `update` |
| 12. `help` / `-h` / `--help` | [Top level](#top-level-by-position) only | `top-first`, `up-flags` |
| 13. `KEY=` across the `=` word break | [`configure`](#configure-by-position) context column, and [Trailing space](#trailing-space) | `cfg-value`, `cfg-free` |
| 14. `--unset <TAB>` | [`configure`](#configure-by-position), "previous word is `--unset`" | `cfg-unset` |
| 15. Static env keys only | [`configure`](#configure-by-position) lists | `cfg-other`, `cfg-unset` |
| 16. `KEY=-` and free-form values | [`configure`](#configure-by-position), "any other key, or `KEY=-`" | `cfg-free` |
| 17. Keys already on the line | [`configure`](#configure-by-position), "minus the keys on the line" | `cfg-unset`, `cfg-other` |

### Never completed

- **Free-form values:** `port`, `bind`, `image-tag`, `stop-timeout` after `KEY=`, and the
  arguments of `-p` / `--port` and `--bind`.
- **`update` versions** (`update [VERSION]`): would need a network call.
- **Passthrough:** any argument of `compose`, which goes to docker compose inside the
  instance.
- **`logs` beyond `-f`:** `logs` is not a passthrough; it takes only `-f`, and any other
  argument is a usage error, so nothing else is offered.
- **Env values**, and `KEY=-` (the value is read hidden).
- **Hidden steps:** `update --finish`.
- **Filenames:** when nothing matches, nothing is offered. There is never a fallback to filename
  or default bash completion.

### Edge cases

Edge cases 1–17 from #424, as behaviour.

#### Invocation

1. **Called by path** (`./kerghan`, `~/.local/bin/kerghan`): works. bash falls back to the rule
   registered for the command's basename.
2. **Symlink or alias under another name** (e.g. `kg`): not covered. Completion binds only
   `kerghan`; the manual fix is `complete -o nospace -F _kerghan <name>`, documented for
   users. Without `-o nospace`, `KEY=` candidates would get a space after them.
3. **bash 3.2 (macOS):** the script works there. It uses no `compopt`, no associative arrays
   (`declare -A`), no `mapfile` / `readarray`, and no bash-completion helpers such as
   `_init_completion`, `_get_comp_words_by_ref` or `__ltrim_colon_completions`: the `eval` route
   must work without the `bash-completion` package.

#### Position and context

4. **Unknown command** (`kerghan foo <TAB>`): nothing.
5. **Commands with nothing left to offer** (`down`, `status`, `version`, …): nothing.
6. **`compose …`** (passthrough) and **`logs` beyond `-f`** (`logs` takes only `-f`):
   nothing.
7. **`update VERSION`:** no version is suggested. Only the flags are offered, before or after a
   version already typed.
8. **Free-form flag arguments** (`--bind <TAB>`, `-p <TAB>`, `--port <TAB>`): nothing, and the
   word after the flag is never taken as a command, a flag or a key.

#### Flags

9. **A flag already on the line** is not offered again, except `configure --unset`, which can
   be repeated (`configure [--unset KEY]...`). Aliases of the same option count as one: once
   `-p` or `--port` is on the line, neither is offered.
10. **Mutually exclusive pairs** (`update --restart` / `--no-restart`, `up --auto-login` /
    `--no-auto-login`): once either is on the line, neither is offered. This is a completion
    choice: `update` rejects both together (a usage error), while `up` accepts both and the
    last one wins; offering the opposite flag is never useful in either case.
11. **Hidden steps** (`update --finish`) are never offered.
12. **`help` / `-h` / `--help`:** offered only where the client accepts them, which is the top
    level. No subcommand takes a help flag, so none is offered after a command.

#### `configure`

13. **Keys complete with `=` attached** (`configure var<TAB>` → `variant=`), with no trailing
    space, so the value follows at once (`variant=<TAB>` → `online offline`). The default
    `COMP_WORDBREAKS` contains `=`, so bash splits `variant=on` into the words `variant`, `=`,
    `on`; the function rebuilds the `KEY=VALUE` word from `COMP_WORDS` / `COMP_CWORD` itself,
    without bash-completion helpers and without changing `COMP_WORDBREAKS`. Right after the
    `=`, the current word may be `=` itself or an empty word whose previous word is `=`,
    depending on the bash version and the cursor position; both cases are handled, on bash 3.2
    and 4+. bash 3.2 has no `compopt`, so the "no trailing space" rule is met by registering
    with `-o nospace` and adding the space to every other candidate (see
    [Trailing space](#trailing-space)).
14. **`--unset <TAB>`** offers bare key names, with no `=`: the config keys and
    `FRONTEND_BASE_URL`, never the `DEFAULT_ENV_KEYS` names (which can't be unset).
15. **Env keys** come only from static names built into the script (`DEFAULT_ENV_KEYS` and
    `FRONTEND_BASE_URL`).
    Completion **never** reads `~/.kerghan/config` or `kerghan.env`, and never completes env
    values.
16. **`KEY=-`** and free-form values: nothing.
17. **A key already on the line** (as `KEY=…`, or after `--unset`) is not offered again.

### Required tests

Harness, file layout and naming: [Testing](#testing). Each case gives its label
(`matrix <label>`, `edge <n>` or `contract <name>`), the input and the exact expected
`COMPREPLY`.

- **Input:** a line in backticks is given to `complete_line` (a trailing space means an empty
  last word); words in parentheses are given to `complete_words`, `''` being an empty word.
- **Expected:** each word in backticks with its trailing space visible (`` `up ` ``), compared
  as a set; "nothing" means `assert_no_reply`.

**Word sets** used below (all from the [per-position table](#per-position-table)):

| Name | Words |
|------|-------|
| `ALL_COMMANDS` | `up `, `down `, `logs `, `status `, `compose `, `reset `, `update `, `update-env `, `configure `, `wizard `, `version `, `completion `, `help `, `-h `, `--help ` (15 words) |
| `UP_FLAGS` | `--offline `, `-p `, `--port `, `--auto-login `, `--no-auto-login `, `--bind `, `-f ` |
| `UPDATE_FLAGS` | `--force `, `--yes `, `--restart `, `--no-restart ` |
| `CONFIG_KEYS=` | `port=`, `variant=`, `runtime=`, `stop-timeout=`, `image-tag=`, `auto-login=`, `bind=`, `restart-on-update=` |
| `ENV_KEYS=` | `KERGHAN_SECRET_KEY=`, `KERGHAN_INTEGRATIONS_KEY=`, `KERGHAN_DEFAULT_USER_ENABLED=`, `KERGHAN_DEFAULT_USER_USERNAME=`, `KERGHAN_DEFAULT_USER_EMAIL=`, `KERGHAN_DEFAULT_USER_PASSWORD=`, `KERGHAN_DEFAULT_USER_ADMIN=`, `FRONTEND_BASE_URL=` |
| `UNSET_KEYS` | `port `, `variant `, `runtime `, `stop-timeout `, `image-tag `, `auto-login `, `bind `, `restart-on-update `, `FRONTEND_BASE_URL ` |

The literal lists are the client's today; the sync tests below guard them against the client's
constants, so a test may build these sets from the same constants instead of hard-coding them.

#### `completion.bats`

**Registration**

| Label | Input | Expected |
|-------|-------|----------|
| `contract _kerghan` | `complete -p kerghan`, after `source_completion` | stdout exactly `complete -o nospace -F _kerghan kerghan` |

**Top level**

| Label | Input | Expected |
|-------|-------|----------|
| `matrix top-first` | `kerghan ` | `ALL_COMMANDS` |
| `matrix top-first` | `kerghan co` | `compose `, `completion `, `configure ` |
| `matrix top-first` | `kerghan up` | `up `, `update `, `update-env ` |
| `matrix top-first` / edge 12 | `kerghan -` | `-h `, `--help ` |
| `matrix top-later` / edge 4 | `kerghan foo ` | nothing |
| `matrix top-later` / edge 4 | `kerghan -h ` | nothing |
| `matrix top-later` / edge 4 | `kerghan --help ` | nothing |
| edge 1 | `./kerghan ` and `~/.local/bin/kerghan up ` | the same as `kerghan ` (`ALL_COMMANDS`) and `kerghan up ` (`UP_FLAGS`) |

**Commands**

| Label | Input | Expected |
|-------|-------|----------|
| `matrix up-flags` / edge 12 | `kerghan up ` | `UP_FLAGS` (no `help `, `-h ` or `--help `) |
| `matrix up-flags` / edge 12 | `kerghan up -` | `UP_FLAGS` |
| `matrix up-flags` / edge 9 | `kerghan up --offline ` | `UP_FLAGS` minus `--offline ` |
| `matrix up-flags` / edge 9 | `kerghan up -p 8080 ` | `UP_FLAGS` minus `-p ` and `--port ` |
| `matrix up-flags` / edge 9 | `kerghan up --port 8080 ` | `UP_FLAGS` minus `-p ` and `--port ` |
| `matrix up-flags` / edge 10 | `kerghan up --auto-login ` | `UP_FLAGS` minus `--auto-login ` and `--no-auto-login ` |
| `matrix up-flags` / edge 10 | `kerghan up --no-auto-login ` | `UP_FLAGS` minus `--auto-login ` and `--no-auto-login ` |
| `matrix up-flag-arg` / edge 8 | `kerghan up -p ` | nothing |
| `matrix up-flag-arg` / edge 8 | `kerghan up --port ` | nothing |
| `matrix up-flag-arg` / edge 8 | `kerghan up --bind ` | nothing |
| `matrix up-flag-arg` / edge 8 | `kerghan up --bind -` | nothing (the argument is never read as a flag) |
| `matrix logs` | `kerghan logs ` | `-f ` |
| `matrix logs` / edge 6 | `kerghan logs -f ` | nothing |
| `matrix update` | `kerghan update ` | `UPDATE_FLAGS` |
| `matrix update` / edge 9 | `kerghan update --force ` | `--yes `, `--restart `, `--no-restart ` |
| `matrix update` / edge 10 | `kerghan update --restart ` | `--force `, `--yes ` |
| `matrix update` / edge 10 | `kerghan update --no-restart ` | `--force `, `--yes ` |
| `matrix update` / edge 7 | `kerghan update 0.9.0 ` | `UPDATE_FLAGS` |
| `matrix update` / edge 11 | `kerghan update --f` | `--force ` (never `--finish `) |
| `matrix wizard` | `kerghan wizard ` | `--advanced ` |
| `matrix wizard` / edge 9 | `kerghan wizard --advanced ` | nothing |
| `matrix completion-first` | `kerghan completion ` | `bash ` |
| `matrix completion-first` | `kerghan completion b` | `bash ` |
| `matrix completion-later` | `kerghan completion bash ` | nothing |
| `matrix no-args` / edge 5 | `kerghan down `, `status `, `reset `, `update-env `, `version `, `help ` (one case each) | nothing |
| `matrix no-args` / edge 6 | `kerghan compose ` and `kerghan compose ps ` | nothing |

**`configure`**

| Label | Input | Expected |
|-------|-------|----------|
| `matrix cfg-other` | `kerghan configure ` | `--show-secrets `, `--force `, `--unset `, `CONFIG_KEYS=`, `ENV_KEYS=` (no bare key, no space after `=`) |
| `matrix cfg-other` / edge 13 | `kerghan configure var` | `variant=` |
| `matrix cfg-other` / edge 9 | `kerghan configure --force ` | `--unset `, `CONFIG_KEYS=`, `ENV_KEYS=` |
| `matrix cfg-other` / edge 17 | `(kerghan configure variant = x '')` | `--force `, `--unset `, `CONFIG_KEYS=` minus `variant=`, `ENV_KEYS=` |
| `matrix cfg-other` / edges 16, 17 | `(kerghan configure port = - '')` | `--force `, `--unset `, `CONFIG_KEYS=` minus `port=`, `ENV_KEYS=` |
| `matrix cfg-other` / edge 17 | `kerghan configure --unset port ` | `--force `, `--unset `, `CONFIG_KEYS=` minus `port=`, `ENV_KEYS=` |
| `matrix cfg-show-secrets` | `kerghan configure --show-secrets ` | nothing |
| `matrix cfg-unset` / edge 14 | `kerghan configure --unset ` | `UNSET_KEYS` (bare, no `KERGHAN_*` name) |
| `matrix cfg-unset` / edge 17 | `kerghan configure --unset port --unset ` | `UNSET_KEYS` minus `port ` |
| `matrix cfg-value` / edge 13 | `(kerghan configure variant =)` and `(kerghan configure variant = '')` | `online `, `offline ` |
| `matrix cfg-value` / edge 13 | `(kerghan configure variant = on)` | `online ` |
| `matrix cfg-value` / edge 13 | `(kerghan configure runtime =)` and `(… runtime = '')` | `auto `, `sysbox `, `privileged ` |
| `matrix cfg-value` / edge 13 | `(kerghan configure runtime = s)` | `sysbox ` |
| `matrix cfg-value` / edge 13 | `(kerghan configure auto-login =)` and `(… auto-login = '')` | `true `, `false ` |
| `matrix cfg-value` / edge 13 | `(kerghan configure auto-login = t)` | `true ` |
| `matrix cfg-value` / edge 13 | `(kerghan configure restart-on-update =)` and `(… restart-on-update = '')` | `ask `, `always `, `never ` |
| `matrix cfg-value` / edge 13 | `(kerghan configure restart-on-update = a)` | `ask `, `always ` |
| `matrix cfg-free` / edge 16 | `(kerghan configure KEY =)` and `(… KEY = '')`, for each of `port`, `bind`, `image-tag`, `stop-timeout` | nothing |
| `matrix cfg-free` / edges 15, 16 | `(kerghan configure KERGHAN_SECRET_KEY =)`, `(… FRONTEND_BASE_URL = '')` | nothing (env values are never offered) |
| `matrix cfg-free` / edge 16 | `(kerghan configure port = -)` | nothing |

**Never filenames**

| Label | Input | Expected |
|-------|-------|----------|
| `matrix top-first` | `kerghan up`, run in a temp `PWD` holding a file `upfile` | `up `, `update `, `update-env ` (no `upfile`) |
| `matrix top-later` | `kerghan foo u`, same `PWD` | nothing |

Edges 3 (bash 3.2) and 15 (no file read) are not repeated here: every case in this file also
runs in the bash 3.2 service, and the no-file-read checks are in
[performance and security required tests](#required-tests-3). Edge 2 (`kg`) is `contract _kerghan` in
[command required tests](#required-tests).

#### `completion_sync.bats`

Each check compares sets and, on failure, names the word and the side it is missing from, for
example `--bind: in usage, not in completion` or `ask: in RESTART_ON_UPDATE values, not in
completion`. Completions are read through the same harness as `completion.bats`.

| Label | Setup | Expected |
|-------|-------|----------|
| sync usage commands | parse the words under `Commands:` in `kerghan help` | they equal the top-level completion words (`kerghan ` minus `help `, `-h `, `--help `); `help`, `-h` and `--help` are checked separately as accepted by the client |
| sync usage flags | for each command, parse its synopsis line in `kerghan help` (`up [--offline] [-p PORT] …`, `configure [--force] [--unset KEY]…`, `wizard [--advanced]`, …), expanding `--[no-]x` to `--x` and `--no-x` and counting `-p, --port` as both | the flags equal what `kerghan <command> ` offers, minus the exclusion list |
| sync usage keys | parse the config keys under `Settings are read from …` in `kerghan help` | they equal the config keys `kerghan configure ` offers (without `=`); the env key names offered equal `DEFAULT_ENV_KEYS` plus `FRONTEND_BASE_URL` read from the client |
| sync generated lists | source the client (its `BASH_SOURCE` guard keeps `main` from running) and read `CONFIG_KEYS`, `DEFAULT_ENV_KEYS`, the `FRONTEND_BASE_URL` constant and the four value constants | `kerghan configure ` offers each config and env key as `KEY=`; `kerghan configure --unset ` offers exactly the config keys plus `FRONTEND_BASE_URL`, no `DEFAULT_ENV_KEYS`; each `KEY=` value list equals that key's value constant |
| sync classification | the test's `FREE_FORM_KEYS` list | every `CONFIG_KEYS` entry is in `FREE_FORM_KEYS` or has a value constant, never both and never neither |

The test holds both lists as commented constants, so adding to either is a visible diff:

```bash
# Accepted by the client, never completed (hidden steps).
EXCLUDED_WORDS="--finish"
# Config keys whose value is typed freely; every other config key has a value constant.
FREE_FORM_KEYS="port bind image-tag stop-timeout"
```

The constant names read from the client are internal; the test changes with them (see
[Sync rule](#sync-rule)).

**`completion_safety.bats`:** completion reads no file, in particular not `~/.kerghan/config` or `kerghan.env`: the
sentinel-config case in [performance and security required tests](#required-tests-3).

Every case above runs in both bash services (the `completion*.bats` glob), and every
label in the per-position table and every edge case has at least one case.

## Installer setup

The completion step in `standalone/install.sh` (`install_completion`).

### Constraint

`install.sh` is a stable contract that `kerghan update` relies on (see its header and
[Installer `update` contract](#installer-update-contract)): no prompts, no sudo, `mv -f` as the only
write to the install dir, non-zero exit on any failure, never touches `~/.kerghan` or any Docker
volume. The completion step stays inside that contract, and it never turns a successful client
install into a failure.

The header's "non-zero exit on any failure" gets one deliberate exception: a completion failure
only warns (see [Never fatal](#never-fatal)). The header says so ("any failure of the client or
`vault` install"); `update` relies only on the client install failing loudly, so this is
backward compatible.

The step runs **after** the client is moved into place (`move_client`, itself after
`ensure_vault`), next to `check_path`, so it can run that client.

### Target

```
${BASH_COMPLETION_USER_DIR:-${XDG_DATA_HOME:-$HOME/.local/share}/bash-completion}/completions/kerghan
```

- This is bash-completion v2's user directory. It lazy-loads the file on the first
  `kerghan <TAB>`, with no rc-file edit and no sudo.
- The directory is created with `mkdir -p` when missing.
- The path is documented so users can find or remove the file (there is no uninstaller), and so
  the zsh/fish Epics and any future uninstaller can rely on it (see
  [Completion file path](#completion-file-path)).

Rejected:

- **System directories** (`/usr/share/bash-completion/completions`, `/etc/bash_completion.d`):
  they need sudo, which breaks the contract.
- **Editing `~/.bashrc`:** intrusive and hard to keep idempotent.

### Content

- The file holds the **static output of `<install dir>/kerghan completion bash`**: the exact
  client just installed, by its absolute path, never `kerghan` from `PATH` (see
  [Exact binary](#exact-binary)).
- The output is written to a temp file **in the target directory**, then `mv -f`'d into place,
  the same way the client itself is installed.
- **Refreshed on every run:** every install, every manual rerun, and every `kerghan update`
  (which reruns `install.sh`) rewrites the file, so it always matches the installed client.

Rejected:

- **A loader line** (`eval "$(kerghan completion bash)"` in the file): it runs whichever
  `kerghan` is first on `PATH`, possibly not the one just installed.

### Without the `bash-completion` package

The file is still installed. When bash-completion is not detected, a `hint:` prints the line to
add to `~/.bashrc` by hand: `source "<file>"` (exact text in [Messages](#messages)). This is not
an error and does not change the exit code.

Users may instead load it with `eval "$("<install dir>/kerghan" completion bash)"`, using the
client's absolute path since the install dir may not be on `PATH` (`check_path` may already have
warned about it). The hint doesn't print this form; the user docs can mention it.

**Detection:** bash-completion counts as installed when any of these files exists:

- `/usr/share/bash-completion/bash_completion` (Linux distros)
- `/opt/homebrew/etc/profile.d/bash_completion.sh` (Homebrew, Apple silicon)
- `/usr/local/etc/profile.d/bash_completion.sh` (Homebrew, Intel)
- `/opt/local/etc/profile.d/bash_completion.sh` (MacPorts)

The step only tests that a file exists. It never runs bash-completion and never reads the
user's rc files.

**Detection override (tests only):**

- The four paths above are the default detection list.
- An internal, test-only variable, **`KERGHAN_BASH_COMPLETION_PATHS`** (space-separated paths),
  replaces the list when set. Tests point it at files under the test root, so the result never
  depends on the host or CI image.
- It only decides whether the hint is printed. It never changes the target path or what is
  written.
- It is not a stable contract and is not documented in the `install.sh` header, unlike
  `KERGHAN_VERSION`, `KERGHAN_INSTALL_DIR` and `KERGHAN_COMPLETION`.

Rejected: a test-root prefix on every path (could be mistaken for a general install root), and
the real paths with no override (the result would depend on the host or CI image).

### Never fatal

If the directory can't be created, the client fails to print the script, or the file can't be
written or moved, the step prints a `warning:` and the install continues. The completion step
never fails an install or an `update`; the installer's exit code reflects only the client (and
`vault`) install, as today.

- **Guarded commands:** the installer runs under `set -euo pipefail`, so every command in the
  step is guarded (`if !` / `||`) and reports through `warn` (which does not exit), never
  `error` + `exit 1`.
- **Client without `completion`:** `KERGHAN_VERSION=<older version>` with a newer `install.sh`
  installs a client that has no `completion` command; it exits `2` with empty stdout. The step
  checks the client's exit code and that its output is non-empty before replacing the file, so
  an existing file is never replaced by an empty one.
- **No temp file left behind:** the existing `trap cleanup EXIT` only removes the `$staging`
  folder, and the temp file lives in the completion directory, so the step removes its own temp
  file on failure (inline, or by extending `cleanup`).

### Opt-out

`KERGHAN_COMPLETION=false` skips the step entirely: nothing is created and no hint is printed.

- It joins the installer interface documented in the `install.sh` header (see
  [`KERGHAN_COMPLETION`](#kerghan_completion)).
- `kerghan update` does not pass it, so the step is **on by default**, including on updates. A
  user who exported `KERGHAN_COMPLETION=false` in their shell keeps the opt-out on updates too,
  since `update` runs the installer with the user's environment.

### Overwrite

An existing file at the target path, including a hand-written one, is replaced by `mv -f` on
every install or update (backward compatibility item 8). This is accepted and documented; the
opt-out is `KERGHAN_COMPLETION=false`.

### Upgrade and downgrade

- **Upgrade from a client without completion** (backward compatibility item 2): `kerghan update`
  runs the new `install.sh`, which installs the file. No manual step, except the `eval` line on
  hosts without `bash-completion`.
- **Downgrade** (backward compatibility item 3): `kerghan update <older version>` runs an older
  `install.sh` that knows nothing about completion. The newer file is left behind and may offer
  commands the older client lacks. This is accepted and documented, not cleaned up. An rc line
  `eval "$(kerghan completion bash)"` then evaluates an empty string (see
  [Output and streams](#output-and-streams)).

### Uninstall

Out of scope: there is no uninstaller. The file's path is documented in [Target](#target).

### Messages

All messages go through the installer's existing helpers: `info` on stdout, `warn` and `hint`
on stderr, all prefixed `kerghan-install:`. `<file>` is the resolved target path (see
[Target](#target)), `<dir>` its directory, and `<install dir>` the absolute install directory.

**Success:** one `info` line, printed after `kerghan <version> installed to …` and before
`check_path`'s output:

```
kerghan-install: bash completion installed to <file>
```

**bash-completion not detected** (see
[Without the `bash-completion` package](#without-the-bash-completion-package)): printed right
after the success line,

```
kerghan-install: hint: bash-completion was not found; to enable completion, add this to ~/.bashrc:
  source "<file>"
```

The second line is printed with `echo … >&2`, the same way `check_path` prints its
`export PATH` line.

**Failure:** one `warn` line naming what failed, and no success line and no hint:

| Failure | stderr |
|---------|--------|
| `mkdir -p` of the directory | `kerghan-install: warning: could not create <dir>; skipping bash completion` |
| the client exits non-zero or prints nothing | `kerghan-install: warning: <install dir>/kerghan completion bash failed; skipping bash completion` |
| writing the temp file or the `mv -f` | `kerghan-install: warning: could not write <file>; skipping bash completion` |

**`KERGHAN_COMPLETION=false`:** nothing is printed.

The exit code is never changed by this step (see [Never fatal](#never-fatal)).

### Required tests

All in `install_completion.bats` (harness and naming: [Testing](#testing)). It uses
`helpers/install_setup.bash` and runs on bash 5 only: running `install.sh` under bash 3.2 is
#433. Unless a case says otherwise, `KERGHAN_BASH_COMPLETION_PATHS` points at files that don't
exist under the test root (so the hint prints), and the install exits `0`. `<file>` is the
resolved target path and `<install dir>` the test's install directory.

The bats container runs as root, so chmod-based failures would not fail: failures are injected
instead (a regular file in the target path, or an `mv` in the test tools dir that fails only for
the target path).

**Target and content**

| Label | Setup | Expected |
|-------|-------|----------|
| target: `BASH_COMPLETION_USER_DIR` | `BASH_COMPLETION_USER_DIR` and `XDG_DATA_HOME` set | the file is `$BASH_COMPLETION_USER_DIR/completions/kerghan` |
| target: `XDG_DATA_HOME` | only `XDG_DATA_HOME` set | the file is `$XDG_DATA_HOME/bash-completion/completions/kerghan` |
| `contract file path` | neither set | the file is `$HOME/.local/share/bash-completion/completions/kerghan` |
| target: directory created | the completions directory doesn't exist | it is created and holds the file |
| exact binary | a `kerghan` stub earlier on `PATH` that prints something else | the file holds `<install dir>/kerghan completion bash`'s output, not the stub's |
| overwrite | a hand-written file already at the target | it is replaced by the client's output |
| `contract KERGHAN_COMPLETION=false` | `KERGHAN_COMPLETION=false` | no file and no directory created; no `bash completion` line on stdout, no hint or `warning:` about completion on stderr |

**Messages**

| Label | Setup | Expected |
|-------|-------|----------|
| success line | a normal install | stdout has `kerghan-install: bash completion installed to <file>`, after the `kerghan <version> installed to …` line and before `check_path`'s output |
| hint printed | no file in `KERGHAN_BASH_COMPLETION_PATHS` exists | the file is installed; stderr has exactly `kerghan-install: hint: bash-completion was not found; to enable completion, add this to ~/.bashrc:` then `  source "<file>"`, with the resolved path; exit code unchanged |
| no hint | one file in `KERGHAN_BASH_COMPLETION_PATHS` exists | the file is installed; no `hint:` line about completion; exit code unchanged |

**Never fatal** (each: the exact `warning:` line, no success line, no hint, install exits `0`)

| Label | Setup | Expected stderr |
|-------|-------|-----------------|
| failure: `mkdir` | `BASH_COMPLETION_USER_DIR` under a regular file | `kerghan-install: warning: could not create <dir>; skipping bash completion` |
| failure: client exits non-zero | a client that exits `2` with empty stdout (as an older client without `completion`), and an existing file at the target | `kerghan-install: warning: <install dir>/kerghan completion bash failed; skipping bash completion`; the existing file is untouched |
| failure: client prints nothing | a client that exits `0` with empty stdout, and an existing file at the target | the same `warning:` line; the existing file is untouched |
| failure: write | an `mv` that fails for the target path | `kerghan-install: warning: could not write <file>; skipping bash completion`; no temp file is left in the directory |

**Safety** (see [performance and security required tests](#required-tests-3))

| Label | Setup | Expected |
|-------|-------|----------|
| temp file in the target directory | a client stub whose `completion bash` lists the target directory's entries before printing | the listing holds a temp file in that directory; after the install only `kerghan` remains |
| symlink replaced | a symlink at the target path pointing at another file | the target is a regular file; the file it pointed at is unchanged |
| not executable | a normal install | the file has no execute bit |

**`update` contract** (see [stable contracts required tests](#required-tests-4))

| Label | Setup | Expected |
|-------|-------|----------|
| `contract update` | stdin closed, a `sudo` stub that logs its calls | nothing created under `~/.kerghan`; the `sudo` log is empty; no prompt (the install finishes with stdin closed) |
| `contract update`: exit unchanged | an `mv` that fails for the target path, compared with a `KERGHAN_COMPLETION=false` run | same exit code; same final output apart from the `warning:` line |

The existing tests in `install.bats` stay untouched: same prompts, exit codes and no sudo. They
run with the completion step on, so they also cover that it changes none of those.

## Performance and security

Performance & security items 1–9 from #424.

### Performance

1. **TAB is pure bash.** Pressing TAB runs no subprocess (no `kerghan`, `docker`, `vault`,
   `curl`, nor external tools such as `grep` or `sed`) and reads no file. Every word list is
   built into the script.
2. **`kerghan completion bash` has no side effects:** it prints the script and exits (see
   [No side effects](#no-side-effects)). The `eval` route runs it on every new shell.
3. **The `eval` route costs one client process per shell start.** The docs recommend the
   lazy-loaded bash-completion file installed by `install.sh` (see [Installer setup](#installer-setup)),
   with `eval "$(kerghan completion bash)"` as the fallback when the `bash-completion` package is
   missing.

### Security

#### Trust boundary

4. **The trust boundary doesn't change.** `eval`-ing the client's output trusts nothing beyond
   running the client itself, which the user already does.

#### Fixed text

5. **The emitted script is fixed text for a given client version.** It is built only from the
   client's own constants (see [Word lists](#word-lists)) and never
   interpolates environment variables, config values, `$HOME`, the current directory or any
   path at generation time, so nothing user- or attacker-controlled reaches the `eval`. Two
   runs with different environments print the same bytes.

#### Shell hygiene

6. **No changes to the user's shell.** Sourcing the script:
   - defines only `_kerghan` (and `_kerghan_*` helpers) plus the `complete` registration;
   - leaves no global variables behind: every variable in the functions is `local`;
   - changes no shell options: no `set -e` / `-u` / `-o pipefail` (the client's own
     `set -euo pipefail` must not leak into the script), no `shopt`, and no lasting `IFS`
     change;
   - works under a user shell that has `set -u` on: the functions never expand an unset
     variable.

   bash 3.2 compatibility is defined in [Invocation](#invocation).

#### No secrets

7. **Completion never reads `kerghan.env`** (or `~/.kerghan/config`) and never completes values.
   The env key names it offers come from the static `DEFAULT_ENV_KEYS` and are already public in
   the docs.

#### Installer writes

8. **The installer's writes are safe:**
   - the temp file is created in the target directory and moved with `mv -f`, which is atomic
     and replaces a symlink at the target rather than following it;
   - the directory is created with `mkdir -p` under the user's umask, and the file is not
     executable;
   - no sudo; writes only under the same user's `BASH_COMPLETION_USER_DIR` / `XDG_DATA_HOME`
     (default `~/.local/share`);
   - the temp file is removed on failure.

#### Exact binary

9. **The installer runs `<install dir>/kerghan completion bash`,** the client it just
   installed, by its absolute path, never `kerghan` from `PATH`. This is the same rule as
   `update`'s exec of the exact path (see
   [client-update.md](client-update.md#stable-contracts)).

### Required tests

Mostly in `completion_safety.bats`, which runs in both bash services; the fixed-text case is in
`completion_command.bats` and the installer cases in `install_completion.bats`. Harness and
the fresh-shell method: [Fresh-shell tests](#fresh-shell-tests).

**Representative completions** used by the fresh-shell cases, with their expected replies from
[completion required tests](#required-tests-1): `kerghan ` (top level), `kerghan up -` (a
flag), `kerghan configure var` (a `configure` key) and `(kerghan configure variant =)` (a
fixed value).

#### `completion_safety.bats`

| Label | Setup | Expected |
|-------|-------|----------|
| hygiene: options | fresh `bash --norc --noprofile`; snapshot `set -o`, `shopt` and `IFS`; source the script; snapshot; run one completion; snapshot | all three snapshots identical |
| hygiene: names | same shell; snapshot the `declare -p` names and `declare -F` names before sourcing and after one completion | the only new names are `_kerghan` and `_kerghan_*` functions; no new variable (`COMPREPLY` and the `COMP_*` inputs set by the test excepted) |
| hygiene: `set -u` | same shell with `set -u` on; run the representative completions | the expected replies; stderr empty |
| no subprocess: empty `PATH` | fresh shell; `PATH` set to an empty directory, `HOME` to an empty temp dir; run the representative completions | the expected replies, stderr empty, exit `0` |
| no subprocess: `command_not_found_handle` | bash 5 only (skipped when `BASH_VERSINFO[0] -lt 4`); as above, with a `command_not_found_handle` that appends to a log file | the log file is empty |
| no file read: sentinel config | fresh shell; `HOME` holds `~/.kerghan/config` and `~/.kerghan/kerghan.env` with sentinel keys (e.g. `SENTINEL_KEY=x`) and a sentinel secret value; run the representative completions plus `kerghan configure ` and `kerghan configure --unset ` | replies identical to the empty-`HOME` run; no sentinel key or value in any reply |
| no secret leak: generator | the same sentinel `HOME`; run `kerghan completion bash` | the sentinel value does not appear in the output |
| static deny-list | `kerghan completion bash`, comment lines stripped | contains none of: `$(`, a backtick, `\|`; `<`, `<(`, `>`; `source`, `.` as a command, `eval`, `read`, `exec`; `$HOME`, `~`, `.kerghan` |
| bash 3.2 guard | skipped unless `KERGHAN_TEST_BASH32=1` | `BASH_VERSINFO[0] -eq 3` |

- **Deny-list exceptions:** if the implementation genuinely needs one of the denied tokens,
  the exception is added here explicitly, with the reason; the test then allows exactly that
  occurrence. A false positive just pushes the code to a simpler form.
- **Why three checks:** the empty-`PATH` check misses reads through builtins (`read`, `<`,
  `source`), which the sentinel check catches; neither sees a `$(…)` of builtins only on bash
  3.2, which forks without running a command, so the static deny-list covers it.

#### Other files

| Label | File | Setup | Expected |
|-------|------|-------|----------|
| fixed text | `completion_command.bats` | `kerghan completion bash` run twice, with different `HOME`, `PWD`, `XDG_DATA_HOME` and `KERGHAN_*` values | byte-identical outputs |
| installer: temp file | `install_completion.bats` | see [installer required tests](#required-tests-2) | the write goes through a temp file in the target directory |
| installer: symlink | `install_completion.bats` | a symlink at the target path, pointing at another file | the symlink is replaced by a regular file; the file it pointed at is unchanged |
| installer: not executable | `install_completion.bats` | a normal install | the file has no execute bit |
| installer: exact binary | `install_completion.bats` | a `kerghan` stub earlier on `PATH` | the file holds the just-installed client's output, not the stub's |

No timing tests: speed is covered structurally by the no-subprocess checks, and wall-clock
assertions would be flaky in CI.

## Stable contracts

The interfaces this feature creates that users, rc files, the installer and later Epics rely
on.

Every contract in this section is **stable**: once a release ships it, it can only grow in
backward-compatible ways. Users put the `eval` line in rc files and aliases in their config, and
`kerghan update` runs installers from other versions, so breaking any of these breaks shells and
updates on released versions.

### `kerghan completion bash`

- **Every later client accepts `kerghan completion bash`** and prints a bash completion script,
  the same rule as `update --finish` (see
  [client-update.md](client-update.md#stable-contracts)). Users put
  `eval "$(kerghan completion bash)"` in rc files.
- **The shell stays an argument.** zsh and fish add their own values (`completion zsh`,
  `completion fish`) without changing `bash`.
- **Streams:** the script on stdout, errors on stderr only (see
  [Output and streams](#output-and-streams)).
- **The script's content can change freely** from one version to the next.

### `_kerghan`

The completion function name **`_kerghan`** is stable. It is documented for aliases and
symlinks (`complete -o nospace -F _kerghan <name>`, see
[Invocation](#invocation)), so renaming it would break those users. The
`-o nospace` is part of the line users copy: without it, `KEY=` candidates get a trailing space
(see [Trailing space](#trailing-space)). Helper names (`_kerghan_*`) are not part
of the contract.

### `KERGHAN_COMPLETION`

`KERGHAN_COMPLETION=false` joins the installer interface documented in the `install.sh` header,
next to `KERGHAN_VERSION` and `KERGHAN_INSTALL_DIR`. Every later installer respects it: the
completion step is skipped (see [Opt-out](#opt-out)).

### Completion file path

```
${BASH_COMPLETION_USER_DIR:-${XDG_DATA_HOME:-$HOME/.local/share}/bash-completion}/completions/kerghan
```

The path is documented (see [Target](#target)), so a future uninstaller and the
zsh/fish Epics can rely on it. Later installers keep writing bash completion there.

### Installer `update` contract

The installer's existing contract with `kerghan update` (see the `install.sh` header and
[client-update.md](client-update.md#stable-contracts)) is **kept**. The
completion step adds:

- no prompt;
- no sudo;
- no write outside the install dir and the completion directory, and no write under
  `~/.kerghan`;
- no new failure: the step is never fatal (see [Never fatal](#never-fatal)). The
  header's "non-zero exit on any failure" is narrowed to the client and `vault` install, which
  is backward compatible (see [Constraint](#constraint)).

`update` passes no new variable to the installer.

### Sync rule

Backward compatibility item 9: **any PR that adds or changes a client command, flag, `configure`
key or fixed value updates the completion in the same PR.** The rule is part of the
[Definition of Done for PRs](../contributing.md#definition-of-done-for-prs) and pointed at from
[Standalone Distribution](../standalone.md).

**Enforcement:** the sync tests in [completion required tests](#required-tests-1) enforce the
rule (word-list sources: [Word lists](#word-lists)):

- the generated lists are compared with the client's constants, after sourcing the client;
- the hand-written lists (commands, per-command flags) are cross-checked against
  `kerghan help`;
- every config key is classified as free-form or fixed-value.

A PR that adds a command, flag, key or value without updating completion fails these tests.

- **The client's constants are not contracts.** The value constants and the
  `FRONTEND_BASE_URL` constant are internal to `standalone/bin/kerghan`, and so
  are `CONFIG_KEYS` and `DEFAULT_ENV_KEYS`. Their names may change; the sync tests change with
  them.
- **The `BASH_SOURCE` guard is an internal test contract.** The client can be sourced without
  running `main`, and the sync tests rely on that. The client header documents it, next to
  the bash 3.2 rule. It is not user-facing.

### Required tests

Each stable contract has at least one test named `@test "contract <name>: …"` (see
[Testing](#testing)), so a failure reads as a user-facing break.

| Label | File | Input or setup | Expected |
|-------|------|----------------|----------|
| `contract completion bash` | `completion_command.bats` | `kerghan completion bash` | exit `0`, a script on stdout, stderr empty (see [command required tests](#required-tests)) |
| `contract _kerghan` | `completion_command.bats` | source the script | `complete -p kerghan` prints exactly `complete -o nospace -F _kerghan kerghan` |
| `contract complete -o nospace -F _kerghan kg` | `completion_command.bats` | source the script, run `complete -o nospace -F _kerghan kg`, then complete words `(kg '')`, `(kg up '')` and `(kg configure variant =)` | the same replies as `(kerghan '')`, `(kerghan up '')` and `(kerghan configure variant =)` |
| `contract file path` | `install_completion.bats` | run `install.sh` with neither `BASH_COMPLETION_USER_DIR` nor `XDG_DATA_HOME` set | the file is `$HOME/.local/share/bash-completion/completions/kerghan` (all three resolutions: [installer required tests](#required-tests-2)) |
| `contract KERGHAN_COMPLETION=false` | `install_completion.bats` | run `install.sh` with `KERGHAN_COMPLETION=false` | no completion file, no directory created, no completion line on stdout or stderr |
| `contract update` | `install_completion.bats` | run `install.sh` with stdin closed and an `mv` that fails for the target path | no prompt, no sudo, nothing under `~/.kerghan`; exit code and final output match a run without the completion step, apart from the `warning:` line |
| sync rule | `completion_sync.bats` | the sync cases | see [`completion_sync.bats`](#completion_syncbats) |

## Testing

Every rule is tested from the "Required tests" section of the part of this page that defines it.
This section describes, once, how those tests are written and run.

### Harness

Tests drive `_kerghan` directly in the test shell with explicit `COMP_WORDS`. They do not
simulate readline: word splitting depends on the bash version (`COMP_WORDBREAKS`), so a helper
re-implementing it would only test itself.

`standalone/test/helpers/completion.bash`, loaded after `helpers/setup.bash` (reusing its temp
`HOME` and failing stubs), provides:

| Helper | What it does |
|--------|--------------|
| `source_completion` | Writes `"$KERGHAN" completion bash` to `$BATS_TEST_TMPDIR/completion.bash` and sources it into the test shell itself, not through `run`, since `COMPREPLY` is read afterwards. |
| `complete_words LINE -- WORD...` | The core call. Sets `COMP_LINE=LINE`, `COMP_POINT=${#LINE}`, `COMP_WORDS=(WORD...)` and `COMP_CWORD` to the last index, then calls `_kerghan kerghan "$cur" "$prev"` (the three arguments bash passes). |
| `complete_line LINE` | Convenience for lines without `=` or `:`: splits on whitespace only, so a trailing space becomes an empty last word. Fails the test if `LINE` contains `=` or `:`, forcing those cases through `complete_words`. |
| `assert_reply WORD...` | `COMPREPLY` equals the expected words exactly, order-insensitive. Trailing spaces are significant. On failure it prints expected vs actual with each word bracketed (`[up ]`). |
| `assert_no_reply` | `COMPREPLY` is empty. |

- **Cursor at the end:** the cursor is always at the end of the line; mid-line completion is
  not tested.
- **Exact strings:** "no trailing space after `variant=`" is an exact-string assertion
  (`` `variant=` `` vs `` `up ` ``), whatever mechanism the implementation uses.
- **Dual `=` shapes:** every `=` case runs with each shape this page names.
  `kerghan configure variant=` runs as words `(… variant =)` and as `(… variant = '')`;
  `kerghan configure variant=on` runs as `(… variant = on)`. Together with the bash 3.2 service
  this covers both versions without guessing which split each produces.
- **Registration:** `complete -p kerghan` prints exactly
  `complete -o nospace -F _kerghan kerghan`.

### Fresh-shell tests

Hygiene and safety tests do not run in the bats shell: bats enables `errexit`/`errtrace` and
defines its own functions and variables. They run a fresh `bash --norc --noprofile` with a
small script that:

1. snapshots `set -o`, `shopt`, `IFS`, the `declare -p` names and the `declare -F` names;
2. sources the script and runs a completion;
3. snapshots again and diffs.

The same fresh shell also runs the representative completions with `set -u` on and expects
the same replies and empty stderr. The empty-`PATH` and sentinel-config checks
([performance and security required tests](#required-tests-3)) run there too.

### bash 3.2

The completion tests run under a real bash 3.2, in addition to the bash 5 run. No static lint.

- **Image:** `dockerfiles/bats_bash32/Dockerfile`, `FROM bash:3.2` (official image, bash
  3.2.57, the version macOS ships), with bats-core installed at the suite's pinned version
  (1.11.0).
- **docker-compose:** the `bats_bash32` service, next to the main bats one. It runs
  `standalone/test/completion*.bats` and sets `KERGHAN_TEST_BASH32=1`.
- **CircleCI:** the `standalone_completion_bash32` job runs the same glob under that image,
  alongside the `standalone_tests` job (`bats standalone/test`). The full suite keeps running on
  bash 5, so completion is tested under both.
- **Guard:** a test in `completion_safety.bats` asserts `BASH_VERSINFO[0] -eq 3`. It is skipped
  unless `KERGHAN_TEST_BASH32=1`, so a base-image change cannot silently turn the service into a
  bash 5 run.
- **Same tests on both versions:** bash 3.2 and 4+ split `COMP_WORDS` differently around `=`,
  so the `=` cases run in both services from the same file. There are no 3.2-only tests.

Rejected:

- **The whole suite under 3.2:** the right long-term goal, tracked separately (#433).
- **A static lint for bash-4-only syntax:** redundant once every matrix row runs under 3.2,
  brittle, and prone to false positives.

### File layout

All client completion tests live in `standalone/test/completion*.bats`; the bash 3.2 service
runs exactly that glob.

| File | Holds | bash 5 | bash 3.2 |
|---|---|---|---|
| `completion.bats` | matrix rows, edge cases, registration, dual `=` shapes | ✓ | ✓ |
| `completion_command.bats` | `kerghan completion …` output, errors, exit codes, generator side effects, contracts (`_kerghan`, `complete -o nospace -F _kerghan kg`) | ✓ | ✓ |
| `completion_safety.bats` | hygiene snapshot, empty `PATH`, sentinel config, static deny-list, `BASH_VERSINFO` guard | ✓ | ✓ |
| `completion_sync.bats` | usage cross-check and the single-source-of-truth tests | ✓ | ✓ |
| `install_completion.bats` | installer step: path resolution, opt-out, hint, non-fatal, overwrite, temp file and symlink, not executable, runs the just-installed client; uses `helpers/install_setup.bash` | ✓ | — |

- `install_completion.bats` is kept out of the 3.2 glob (running `install.sh` under 3.2 is
  #433's scope) and keeps `install.bats` from growing.
- The `BASH_VERSINFO` guard is skipped unless `KERGHAN_TEST_BASH32=1`, which the bash 3.2
  service sets.

### Naming and coverage

- **Prefixes:** test names start with the label used on this page:
  - `@test "matrix <row label>: …"` for each row of the
    [per-position table](#per-position-table) (labels in its `Label` column);
  - `@test "edge <n>: …"` for each [edge case](#edge-cases);
  - `@test "contract <name>: …"` for each [stable contract](#stable-contracts), so a failure
    reads as a user-facing break.
- **Coverage rule:** every table row and every edge case maps to at least one named test (the
  dual `=` shapes count under one label), so coverage is checkable with `grep`. Each "Required
  tests" list cites the same labels; a reviewer checks them against the test names.
- **No coverage table and no meta-test** parsing this page: both would break or decay whenever
  the page is reworded.
- **No timing tests:** speed is guaranteed structurally by the no-subprocess checks;
  wall-clock assertions would be flaky in CI.
