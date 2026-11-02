# Completion rules

What the bash completion script offers, per command and position. Built by #429. Overview:
[README.md](README.md).

## Registration

- The script defines one completion function, **`_kerghan`**, and registers it with
  `complete -F _kerghan kerghan`. Helpers, if any, are prefixed `_kerghan_`.
- `_kerghan` is a stable name (see [contracts.md](contracts.md#_kerghan)).
- The registration never uses `-o default`, `-o bashdefault` or `-o filenames`: completion never
  falls back to filenames (see [Never completed](#never-completed)).

## What is completed

Word lists follow the client today (`standalone/bin/kerghan`).

### Top level

`kerghan <TAB>` offers every command name:

`up`, `down`, `logs`, `status`, `compose`, `reset`, `update`, `update-env`, `configure`,
`wizard`, `version`, `completion`, plus `help`, `-h` and `--help`.

### Per command

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

> **Open — settled by #426:** the source of the word lists: generated from the client's own
> constants (commands, `configure` keys, `DEFAULT_ENV_KEYS` plus `FRONTEND_BASE_URL`, fixed
> values) vs. hand-written in the script and guarded by a sync test.

### Per-position table

> **Open — settled by #427:** the exact per-command, per-position completion table. The rules
> below are the behaviour that table must follow.

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
   `kerghan`; the manual fix is `complete -F _kerghan <name>`, documented for users.
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
    and 4+. bash 3.2 has no `compopt`,
    so the "no trailing space" rule can't be switched per word; how it is met (e.g.
    registering with `-o nospace` and adding the trailing space to every other word) is left
    to the per-position table (see [Per-position table](#per-position-table)) and #429.
14. **`--unset <TAB>`** offers bare key names, with no `=`: the config keys and
    `FRONTEND_BASE_URL`, never the `DEFAULT_ENV_KEYS` names (which can't be unset).
15. **Env keys** come only from static names built into the script (`DEFAULT_ENV_KEYS` and
    `FRONTEND_BASE_URL`).
    Completion **never** reads `~/.kerghan/config` or `kerghan.env`, and never completes env
    values.
16. **`KEY=-`** and free-form values: nothing.
17. **A key already on the line** (as `KEY=…`, or after `--unset`) is not offered again.

## Required tests

- Sourcing the script registers `_kerghan` for `kerghan`.
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
- `compose <TAB>` and `logs -f <TAB>` offer nothing.
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

> **Open — settled by #428:** the test harness and the full test coverage.
