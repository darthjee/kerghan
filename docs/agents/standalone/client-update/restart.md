# Restart configuration

Part of [Standalone: client update](../client-update.md). This page defines `restart-on-update`, the restart decision after an image pull, and how the setting is read and edited through `configure` and `wizard`.

## Setting and values

The kebab-case key lives in `~/.kerghan/config`:

```text
restart-on-update=ask
```

| Value | Running instance behavior |
|-------|---------------------------|
| `ask` (default) | On a TTY, prompt `Restart Kerghan now? [Y/n]` on stderr. Enter, `Y` or `yes` restarts; other input or EOF leaves it running. Without a TTY, do not prompt or restart. |
| `always` | Restart without asking, using `kerghan up` behavior and preserving the data volume. |
| `never` | Do not restart; print the `kerghan up` hint. |

Missing and empty values both mean `ask`. Only running instances can be restarted; a stopped or never-created instance is never started and gets a `kerghan up` hint. Downgrades never restart. `kerghan update --restart` and `--no-restart` override this setting for one run. `--yes` only confirms a downgrade; it does not request restart.

## Restart decision

Rows apply top-to-bottom; first match wins. `KERGHAN_UPDATE_RESTART` is the handoff override, and takes precedence over the config value.

| Situation | Behavior |
|-----------|----------|
| Downgrade | Never restart; give the manual-switch hint from [versions](versions.md#why-a-downgrade-never-restarts). |
| `kerghan.env` missing while data volume exists | Skip restart; env restore/reset warning and hint explain why `up` would refuse. |
| No running instance | No prompt or restart; hint to run `kerghan up` on the pulled image. |
| Running image already equals the pulled image | No prompt or restart. If env keys were added, hint to run `kerghan down && kerghan up` to apply them. |
| Override/config says `always` | Restart. |
| Override/config says `never` | Do not restart; advise `kerghan up`. |
| `ask` or unset, TTY | Prompt. `Y`, `yes` (any case) or Enter restarts; other input or EOF does not. |
| `ask` or unset, no TTY | No prompt or restart; advise `kerghan up`. |

A restart runs plain `kerghan up` with config/default port, variant, image tag, auto-login and bind; flags from an earlier `up` invocation are not remembered. A restarted instance keeps its data volume. If restart fails, `up`'s errors/hints are followed by `kerghan: error: the restart failed; kerghan was updated to <version>`; no rollback occurs and the exit status is `up`'s.

When a known previous image differs from the pulled image, cleanup guidance names it: after successful restart, `docker image rm <old-image>`; if not restarted, remove it only after `kerghan up`. No hint is printed when stopped, unchanged, unknown, or on downgrade.

## Parser and config behavior

`restart-on-update` is last in `CONFIG_KEYS`, after `bind`. `valid_restart_on_update` accepts exactly lowercase `ask`, `always`, `never`; `load_config` fills/reset `CFG_RESTART_ON_UPDATE`. Invalid values fail through `config_invalid` with expected text `ask, always or never`. Shared config writer helpers use default `ask` and the same validator. Any command loading config validates the key; only `update` acts on it.

`kerghan configure` handles it like any other config key:

- Listing shows the row after `bind`, with source `default` (value `ask`), `file`, or `file, invalid`.
- `kerghan configure restart-on-update` prints the stored value or an empty line if unset.
- `kerghan configure restart-on-update=always` validates and writes it; invalid values are refused without writing.
- `kerghan configure --unset restart-on-update` removes the line.
- Changing only this setting prints `Takes effect on the next 'kerghan update'.`; when stronger changes such as `port` are included, their apply hint takes precedence.

## Wizard, usage and example

The wizard always asks immediately after `bind`, even without `--advanced`, using:

```text
Bind address [127.0.0.1, derived from auto-login]:
Restart after update (ask/always/never) [ask]:
```

Enter keeps the bracketed value; if the key was unset, nothing is written. Invalid answers are re-asked with validator text; `y`/`n` are not translated. An invalid existing value is shown with `[ask]` as the offered default; Enter fixes it to `ask`.

The help settings list shows `restart-on-update=$DEFAULT_RESTART_ON_UPDATE` followed by `ask | always | never (overridden by update --[no-]restart)`. Its concluding paragraph says: `A changed restart-on-update applies to the next 'kerghan update'.` The `standalone/config.example` entry documents prompt behavior, offline/no-TTY behavior, stopped instances, downgrade behavior, overrides, and the commented `#restart-on-update=ask` line.

Older clients that do not know this key warn that it is unknown and ignored when loading config; their `configure` reports it as unknown and refuses to write it. The key is never removed automatically.

## Required tests

In `config.bats`, `configure.bats`, `configure_files.bats`, `wizard.bats`, and `update.bats`:

- Parser accepts all three values; empty/missing uses `ask`; invalid values fail with the expected-values message.
- Configure listing/read/set/unset, invalid-write preservation, and apply-hint precedence.
- Wizard asks immediately after bind with and without `--advanced`; test Enter, invalid retry, invalid current value repair, and no y/n boolean translation.
- Help and `config.example` document the key.
- Update restart matrix covers every setting/override for running and stopped instances, prompts only when required, and never starts stopped instances.
