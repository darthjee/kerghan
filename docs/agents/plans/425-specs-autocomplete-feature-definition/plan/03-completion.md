# completion.md

Create `docs/agents/specs/auto-complete/completion.md`: the completion rules.

- **Registration:** `_kerghan` registered with `complete` for the name `kerghan`. Helpers are prefixed `_kerghan_`.
- **What is completed per command:** use the command and flag list from the plan's Context.
  - Top-level: every command name, plus `help`/`-h`/`--help`.
  - `up`, `logs`, `update`, `wizard`: their flags.
  - `configure`:
    - `--show-secrets`, `--force`, `--unset`.
    - Config keys with `=` attached and no trailing space.
    - Fixed values after `KEY=`: `variant` → `online|offline`, `runtime` → `auto|sysbox|privileged`, `auto-login` → `true|false`, `restart-on-update` → `ask|always|never`.
    - Bare key names after `--unset`.
    - `DEFAULT_ENV_KEYS` names.
  - `completion`: `bash`.
- **Never completed:**
  - Free-form values (`port`, `bind`, `image-tag`, `stop-timeout`, the `-p`/`--bind` arguments).
  - `update` versions.
  - `compose` arguments, and `logs` arguments beyond `-f`.
  - Env values; `KEY=-`.
  - Hidden `update --finish`.
  - Never a fallback to filename completion.
- **Edge cases 1–17 from #424**, as behaviour:
  - Invocation:
    - Called by path: bash falls back to the basename.
    - Symlink or alias: not covered; document `complete -F _kerghan <name>`.
    - bash 3.2: no `compopt`, no associative arrays, no bash-completion helpers such as `_init_completion`.
  - Position:
    - Unknown command: nothing.
    - Commands with nothing to offer: nothing.
    - Passthrough: nothing.
    - `update VERSION`: flags only.
    - Free-form flag arguments are never mistaken for a command or key.
  - Flags:
    - No repeats.
    - Mutually exclusive pairs hide both once one is typed.
    - Hidden steps are never offered.
    - Help only where the client accepts it (top level).
  - `configure`:
    - `KEY=` handling across `COMP_WORDBREAKS`.
    - `--unset` gives bare keys.
    - Env names come from the static constant only; never read config or env files.
    - `KEY=-` and free-form values: nothing.
    - A key already on the line is not offered again.
- **Open markers:**
  - → #426: the source of the word lists (generated from the client's constants vs. hand-written + sync test).
  - → #427: the exact per-position table.
- **Required tests:** one bullet per rule above. Open marker → #428.

## Files to Change
- `docs/agents/specs/auto-complete/completion.md` — new.
