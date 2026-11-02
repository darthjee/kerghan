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
  `KERGHAN_DEFAULT_USER_*`).
- **Fixed values after `KEY=`:**

  | Key | Values |
  |-----|--------|
  | `variant` | `online`, `offline` |
  | `runtime` | `auto`, `sysbox`, `privileged` |
  | `auto-login` | `true`, `false` |
  | `restart-on-update` | `ask`, `always`, `never` |

- **After `--unset`:** bare key names (config and env), with no `=`.

### Word lists

> **Open — settled by #426:** the source of the word lists: generated from the client's own
> constants (commands, `configure` keys, `DEFAULT_ENV_KEYS`, fixed values) vs. hand-written in
> the script and guarded by a sync test.

### Per-position table

> **Open — settled by #427:** the exact per-command, per-position completion table. The rules
> below are the behaviour that table must follow.

## Never completed

- **Free-form values:** `port`, `bind`, `image-tag`, `stop-timeout` after `KEY=`, and the
  arguments of `-p` / `--port` and `--bind`.
- **`update` versions** (`update [VERSION]`): would need a network call.
- **Passthrough:** any argument of `compose`, and `logs` arguments beyond `-f`.
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
6. **Passthrough** (`compose …`, `logs` arguments beyond `-f`): nothing.
7. **`update VERSION`:** no version is suggested. Only the flags are offered, before or after a
   version already typed.
8. **Free-form flag arguments** (`--bind <TAB>`, `-p <TAB>`, `--port <TAB>`): nothing, and the
   word after the flag is never taken as a command, a flag or a key.

### Flags

9. **A flag already on the line** is not offered again.
10. **Mutually exclusive pairs** (`--restart` / `--no-restart`, `--auto-login` /
    `--no-auto-login`): once either is on the line, neither is offered.
11. **Hidden steps** (`update --finish`) are never offered.
12. **`help` / `-h` / `--help`:** offered only where the client accepts them, which is the top
    level. No subcommand takes a help flag, so none is offered after a command.

### `configure`

13. **Keys complete with `=` attached** (`configure var<TAB>` → `variant=`), with no trailing
    space, so the value follows at once (`variant=<TAB>` → `online offline`). The default
    `COMP_WORDBREAKS` contains `=`, so bash splits `variant=on` into separate words; the
    function rebuilds the `KEY=VALUE` word from `COMP_WORDS` / `COMP_CWORD` itself, without
    bash-completion helpers and without changing `COMP_WORDBREAKS`. bash 3.2 has no `compopt`,
    so the "no trailing space" rule can't be switched per word; how it is met (e.g.
    registering with `-o nospace` and adding the trailing space to every other word) is left
    to the per-position table (see [Per-position table](#per-position-table)) and #429.
14. **`--unset <TAB>`** offers bare key names, with no `=`.
15. **Env keys** come only from the static `DEFAULT_ENV_KEYS` names built into the script.
    Completion **never** reads `~/.kerghan/config` or `kerghan.env`, and never completes env
    values.
16. **`KEY=-`** and free-form values: nothing.
17. **A key already on the line** (as `KEY=…`, or after `--unset`) is not offered again.

## Required tests

- Sourcing the script registers `_kerghan` for `kerghan`.
- `kerghan <TAB>` offers every command name plus `help`, `-h`, `--help`.
- Each command in [Per command](#per-command) offers exactly its listed words.
- `configure <TAB>` offers its flags, the config keys with `=` and the `DEFAULT_ENV_KEYS` names
  with `=`, with no trailing space after a key.
- `configure variant=<TAB>`, `runtime=`, `auto-login=`, `restart-on-update=` offer their fixed
  values.
- `configure --unset <TAB>` offers bare key names with no `=`.
- Free-form values (`port=`, `bind=`, `image-tag=`, `stop-timeout=`, `-p`, `--port`, `--bind`)
  offer nothing.
- `configure KEY=-` offers nothing; env values are never offered.
- `update <TAB>` never offers versions or `--finish`; `update 0.9.0 <TAB>` still offers the
  flags.
- `compose <TAB>` and `logs -f <TAB>` beyond `-f` offer nothing.
- An unknown command offers nothing, and no case falls back to filenames.
- Calling the client by path (`./kerghan`) completes the same as `kerghan`.
- A flag already on the line is not offered again.
- Once one flag of a mutually exclusive pair is on the line, neither is offered.
- `-h` / `--help` / `help` are offered at the top level only.
- A key already on the line is not offered again.
- Completion reads no file (in particular not `~/.kerghan/config` or `kerghan.env`).
- Every case above passes under bash 3.2.

> **Open — settled by #428:** the test harness and the full test coverage.
