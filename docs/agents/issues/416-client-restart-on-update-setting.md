# Issue: Client: `restart-on-update` setting

## Description

Second sub-issue of the client update Epic (#414). Add the `restart-on-update` setting to the `kerghan` client, following the spec written in the first sub-issue: [`docs/agents/specs/client-update/setting.md`](../specs/client-update/setting.md) is the source of truth for exact labels, messages and verbatim texts.

- **Key:** `restart-on-update` in `~/.kerghan/config`, with values `ask` | `always` | `never` and default `ask` (new `DEFAULT_RESTART_ON_UPDATE=ask` constant). A missing line or an empty value uses the default.
- **Config parser:** a new `valid_restart_on_update` (exactly `ask`, `always`, `never`, lower-case), a new `CFG_RESTART_ON_UPDATE` global reset with the others, and a `restart-on-update)` case in `load_config` that reports invalid values through `config_invalid` (`expected ask, always or never`). Append the key last in `CONFIG_KEYS` (after `bind`), and wire it into `valid_config_value`, `config_expected` and `config_default`. The header comment listing persistent settings adds the key.
- **`kerghan configure`:** list it (row after `bind`, source `file` / `default` / `file, invalid`), read it, set it and unset it like the other config keys, with no special case.
- **Apply hint:** a call that changes only `restart-on-update` prints `Takes effect on the next 'kerghan update'.`; when other keys changed too, their strongest hint is printed instead.
- **`kerghan wizard`:** always asked (not only with `--advanced`), right after `bind` as the last config question before the default-user questions. Label: `Restart after update (ask/always/never)`, with the usual bracket convention. Not a boolean key: `y`/`n` are not translated.
- **Docs in the client:** the `usage` settings list (one line after `bind=` plus one closing sentence) and `standalone/config.example` (entry after `bind`), verbatim from the spec.

### Scope

In scope: `standalone/bin/kerghan` (header comment, parser, `configure` and its apply hint, `wizard`, `usage`), `standalone/config.example`, and the bats tests under `standalone/test/` (`config.bats`, `configure.bats`, `configure_files.bats`, `wizard.bats`).

Out of scope: the `kerghan update` command itself (including `--restart` / `--no-restart`), which is the next sub-issue and the only consumer of this key. The fold of the spec into permanent docs (e.g. `docs/agents/standalone/client-config.md`) is the last sub-issue of the Epic.

## Problem

`kerghan update` restarts the instance according to a user setting. That setting has to exist, be validated, and be settable through `configure` and `wizard` before the command can read it.

## Expected Behavior

- `restart-on-update=ask|always|never` is accepted in `~/.kerghan/config`; a missing line or empty value means `ask`. Other values (e.g. `yes`, `Always`, `true`) make `load_config` fail with exit `1` and the usual `config_invalid` error `(expected ask, always or never)`.
- `kerghan configure` lists the key after `bind`; `kerghan configure restart-on-update` prints the file value (empty line when unset); `kerghan configure restart-on-update=always` sets it (invalid values refused with exit `1`, nothing written); `kerghan configure --unset restart-on-update` removes the line.
- Changing only `restart-on-update` through `configure` prints `Takes effect on the next 'kerghan update'.`; changing it together with e.g. `port` prints the `kerghan up` hint instead.
- `kerghan wizard` (with and without `--advanced`) asks `Restart after update (ask/always/never) [<current or ask>]:` right after `bind`. Enter keeps the bracketed value (nothing written when unset); an invalid answer is re-asked; an invalid current value is offered as `[ask] (current value '<v>' is invalid)` and fixed by Enter.
- `kerghan help` lists `restart-on-update=ask` with its description, and `standalone/config.example` contains the `#restart-on-update=ask` entry.
- Bats tests cover the parser, `configure` (listing, read, set, unset, apply hint), `wizard` (every existing answer sequence gains one Enter after `bind`), usage and `config.example`.
