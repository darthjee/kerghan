# Completion rules

What the bash completion script offers, per command and position. Built by #429. Overview:
[README.md](README.md).

## Registration

- The script defines one completion function, **`_kerghan`**, and registers it with
  `complete -o nospace -F _kerghan kerghan`. Helpers, if any, are prefixed `_kerghan_`.
- `_kerghan` is a stable name (see [contracts.md](contracts.md#_kerghan)).
- **`-o nospace` is the only option allowed.** The registration never uses `-o default`,
  `-o bashdefault` or `-o filenames`: completion never falls back to filenames (see
  [Never completed](#never-completed)).

### Trailing space

bash 3.2 has no `compopt`, so the trailing space can't be switched per word. The strategy is
fixed:

- bash adds no space by itself (`-o nospace`).
- `_kerghan` appends a space to **every candidate except `KEY=` candidates** (`port=`,
  `KERGHAN_SECRET_KEY=`, …), so a command, a flag, a fixed value or a bare `--unset` key is
  followed by a space, and the value of a `KEY=` follows at once.
- When a single candidate remains, bash inserts it as is, so the space must already be part of
  the word in `COMPREPLY`.

## What is completed

Word lists follow the client today (`standalone/bin/kerghan`).

### Top level

`kerghan <TAB>` offers every command name:

`up`, `down`, `logs`, `status`, `compose`, `reset`, `update`, `update-env`, `configure`,
`wizard`, `version`, `completion`, plus `help`, `-h` and `--help`.

### Per command

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

### `configure`

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

### Word lists

A mix: what the client holds as data is generated, what only exists as `case` code is
hand-written.

| List | Source | Why |
|------|--------|-----|
| `configure` config keys | **Generated** from `CONFIG_KEYS` | Already a constant. |
| Env keys | **Generated** from `DEFAULT_ENV_KEYS` plus a constant holding `FRONTEND_BASE_URL` (#434) | Mostly data already. |
| Fixed values | **Generated** from four value constants, one per key (#434) | The `valid_*` validators and their messages read the same constants: one source for validation and completion. |
| Commands | **Hand-written** in `_kerghan` | A `case` pattern can't take its alternatives from a variable, so a constant wouldn't drive the `main` dispatch. |
| Per-command flags | **Hand-written** in `_kerghan` | Same reason: each `cmd_*` parser matches its flags in a `case`. |

- **"Generated"** means `kerghan completion bash` prints the lists from the client's own
  constants. The script is still fixed text for a given client version: never built from
  environment variables, config, `$HOME` or paths (see [security.md](security.md#fixed-text)).
- **Hand-written** lists are guarded by the `kerghan help` cross-check (see
  [Required tests](#required-tests)).
- **The `--unset` list** (the config keys plus `FRONTEND_BASE_URL`, no `DEFAULT_ENV_KEYS`) is
  derived from the generated lists, never kept as a separate list, so it can't drift on its own.
- The client refactor that adds the missing constants (the four value constants, the
  `FRONTEND_BASE_URL` constant) and documents the `BASH_SOURCE` guard is #434. It changes no
  behaviour and must merge before #429.

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

### Per-position table

The exact candidates for every command and cursor position. It is the source #429 builds
against; [Per command](#per-command) and [`configure`](#configure) are the summary.

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
tests cite them (`@test "matrix <label>: …"`, see [README.md](README.md#testing)).

#### Top level, by position

| Label | Context | Candidates |
|-------|---------|------------|
| `top-first` | First word after `kerghan` | `up`, `down`, `logs`, `status`, `compose`, `reset`, `update`, `update-env`, `configure`, `wizard`, `version`, `completion`, `help`, `-h`, `--help` |
| `top-later` | Any later word, when the first word is not a command below (`kerghan foo …`, `kerghan -h …`, `kerghan --help …`) | nothing |

#### Commands, by position

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

#### `configure`, by position

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

#### Edge cases in the table

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

## Never completed

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

## Edge cases

Edge cases 1–17 from #424, as behaviour.

### Invocation

1. **Called by path** (`./kerghan`, `~/.local/bin/kerghan`): works. bash falls back to the rule
   registered for the command's basename.
2. **Symlink or alias under another name** (e.g. `kg`): not covered. Completion binds only
   `kerghan`; the manual fix is `complete -o nospace -F _kerghan <name>`, documented for
   users. Without `-o nospace`, `KEY=` candidates would get a space after them.
3. **bash 3.2 (macOS):** the script works there. It uses no `compopt`, no associative arrays
   (`declare -A`), no `mapfile` / `readarray`, and no bash-completion helpers such as
   `_init_completion`, `_get_comp_words_by_ref` or `__ltrim_colon_completions`: the `eval` route
   must work without the `bash-completion` package.

### Position and context

4. **Unknown command** (`kerghan foo <TAB>`): nothing.
5. **Commands with nothing left to offer** (`down`, `status`, `version`, …): nothing.
6. **`compose …`** (passthrough) and **`logs` beyond `-f`** (`logs` takes only `-f`):
   nothing.
7. **`update VERSION`:** no version is suggested. Only the flags are offered, before or after a
   version already typed.
8. **Free-form flag arguments** (`--bind <TAB>`, `-p <TAB>`, `--port <TAB>`): nothing, and the
   word after the flag is never taken as a command, a flag or a key.

### Flags

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

### `configure`

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

## Required tests

- Sourcing the script registers `_kerghan` for `kerghan`, with `-o nospace` and no other
  option.
- Every candidate ends with a space, except `KEY=` candidates, which don't.
- `kerghan <TAB>` offers every command name plus `help`, `-h`, `--help`.
- Each command in [Per command](#per-command) offers exactly its listed words.
- `configure <TAB>` offers its flags, the config keys with `=`, and the `DEFAULT_ENV_KEYS` names
  and `FRONTEND_BASE_URL` with `=`, with no trailing space after a key.
- `configure variant=<TAB>`, `runtime=`, `auto-login=`, `restart-on-update=` offer their fixed
  values.
- `configure --unset <TAB>` offers the config keys and `FRONTEND_BASE_URL` as bare names with
  no `=`, and no `DEFAULT_ENV_KEYS` name.
- `configure --unset port --unset <TAB>` still offers `--unset`-able keys (other than `port`),
  and `--unset` itself stays offered after one `--unset KEY`.
- Free-form values (`port=`, `bind=`, `image-tag=`, `stop-timeout=`, `-p`, `--port`, `--bind`)
  offer nothing.
- `configure KEY=-` offers nothing; env values are never offered.
- `update <TAB>` never offers versions or `--finish`; `update 0.9.0 <TAB>` still offers the
  flags.
- `compose <TAB>`, `logs -f <TAB>` and `wizard --advanced <TAB>` offer nothing.
- `completion <TAB>` offers `bash`; `completion bash <TAB>` offers nothing.
- `configure variant=x <TAB>` and `configure --force <TAB>` don't offer `--show-secrets`.
- `configure --show-secrets <TAB>` offers no `KEY=`, no `--force` and no `--unset`.
- `configure port=- <TAB>` still offers the other `KEY=` candidates.
- `configure <TAB>` never offers a bare key name.
- An unknown command offers nothing, and no case falls back to filenames.
- Calling the client by path (`./kerghan`) completes the same as `kerghan`.
- A flag already on the line is not offered again (except `--unset`); `-p` on the line hides
  `--port` and the other way round.
- Once one flag of a mutually exclusive pair is on the line, neither is offered.
- `-h` / `--help` / `help` are offered at the top level only.
- A key already on the line is not offered again.
- `configure variant=<TAB>` completes the same whether the current word is `=` or an empty word
  after `=`, on bash 3.2 and 4+.
- Completion reads no file (in particular not `~/.kerghan/config` or `kerghan.env`).
- Every case above passes under bash 3.2.
- **Sync — generated lists:** with the client sourced (relying on its `BASH_SOURCE` guard),
  completion offers exactly `CONFIG_KEYS`, `DEFAULT_ENV_KEYS` plus the `FRONTEND_BASE_URL`
  constant, and each value constant for its key.
- **Sync — hand-written lists:** the `kerghan help` cross-check covers the commands and the
  synopsis flags, with `--[no-]x` expanded, aliases counted, and the exclusion list
  (`--finish`) skipped.
- **Sync — classification:** every `CONFIG_KEYS` entry is either in `FREE_FORM_KEYS` or has a
  value constant, never both and never neither.
- In the three sync checks, lists are compared as sets, and a failure names the word and the
  side it is missing from.

> **Open — settled by #428:** the test harness and the full test coverage.
