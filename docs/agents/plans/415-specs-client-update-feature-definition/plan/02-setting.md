# setting.md: `restart-on-update`

Write `docs/agents/specs/client-update/setting.md`, the only file #416 reads:

- **Key and values:** `restart-on-update` in `~/.kerghan/config`, with values `ask` | `always` | `never`. Default `ask`; an empty value uses the default. Define what each value means for `update` (`ask` prompts `Restart Kerghan now? [Y/n]` when the instance is running, and without a TTY behaves like `never` and prints the `kerghan up` hint; `always` restarts like `kerghan up`; `never` prints the hint). Restart only applies to a running instance.
- **Parser:** added to `CONFIG_KEYS` and the per-key validation, range text and default helpers (following the existing `valid_*` / `config_invalid` convention). The range text is `ask, always or never`. Invalid values fail like the other keys.
- **`kerghan configure`:** listed, read, set and unset (`--unset`) like every other config key.
- **`kerghan wizard`:** always asked (not only with `--advanced`), after `bind`, as the last config question before the default-user questions. The exact label is `Restart after update (ask/always/never)`, with the current value in brackets per the wizard convention.
- **Per-run override:** `kerghan update --restart` / `--no-restart` win over the setting (defined in `command.md`; cross-link to it).
- **Exact lines:** the `usage` settings-list line (e.g. `  restart-on-update=ask  ask | always | never (overridden by update --[no-]restart)`) and the `standalone/config.example` entry. #416 copies them verbatim.
- **Downgrade note:** clients older than this setting warn `unknown key 'restart-on-update' (ignored)`. This is accepted and not removed automatically (cross-link to `versions.md`).
- **Required tests:** parser accept and reject for each value and for an empty value; `configure` set, read, unset and list; the wizard asks it after `bind` with and without `--advanced` and keeps the current value on Enter; the usage text lists it.

## Files to Change
- `docs/agents/specs/client-update/setting.md` — new.
