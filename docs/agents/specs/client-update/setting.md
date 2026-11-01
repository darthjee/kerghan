# `restart-on-update` setting

What `kerghan update` does with a **running** instance once the new client and image are
installed. Built by #416; read by `kerghan update` ([command.md](command.md#restart-decision)),
which only reads it. Overview: [README.md](README.md).

## Key and values

A new key in `~/.kerghan/config`, kebab-case like the others:

```
restart-on-update=ask
```

| Value | On `kerghan update`, when the instance is running |
|-------|------|
| `ask` (default) | Prompt `Restart Kerghan now? [Y/n]` on stderr. `Y` / Enter restarts; `n` leaves it running and prints the `kerghan up` hint. Without a TTY (`is_tty` false), no prompt: behaves like `never`. |
| `always` | Restart without asking, the same as `kerghan up`: the container is recreated and the data volume is kept. |
| `never` | No restart; print the `kerghan up` hint. |

- **Default `ask`**, so nothing restarts silently. A missing line and an empty value
  (`restart-on-update=`) both use the default, like every other key.
- **Only a running instance is ever restarted.** With a stopped (or never created) instance,
  every value behaves the same: no restart, no prompt, and the `kerghan up` hint (see
  [command.md](command.md#instance-state)).
- **A downgrade never restarts**, whatever the value (see
  [versions.md](versions.md#downgrade)).
- **Per-run override:** `kerghan update --restart` / `--no-restart` win over the setting for
  that run, mirroring `up --[no-]auto-login` (see [command.md](command.md#options)). `--yes`
  does not imply a restart; it only confirms a downgrade.
- The exact prompt answers, hints and messages are in
  [command.md](command.md#restart-decision).

## Parser

`restart-on-update` joins the existing config keys, following their conventions:

- **`CONFIG_KEYS`**: appended last, after `bind`, so the listing order is `port variant runtime
  stop-timeout image-tag auto-login bind restart-on-update`.
- **Validator:** a new `valid_restart_on_update` accepting exactly `ask`, `always` and `never`
  (lower-case; no trimming beyond what `load_config` already does).
- **`load_config`:** a new `CFG_RESTART_ON_UPDATE` global (reset with the others), filled by a
  new `restart-on-update)` case. An invalid value fails through `config_invalid` like the other
  keys:

  ```
  kerghan: error: /home/me/.kerghan/config:9: invalid restart-on-update 'yes' (expected ask, always or never)
  ```

- **Shared writer helpers:** `valid_config_value` maps the key to `valid_restart_on_update`;
  `config_expected` prints `ask, always or never`; `config_default` prints `ask` (from a new
  `DEFAULT_RESTART_ON_UPDATE=ask` constant).
- The client's header comment, which lists the persistent settings, adds `restart-on-update`.

The key is loaded with the rest of the config, so every command that already calls
`load_config` validates it. Only `kerghan update` acts on it.

## `kerghan configure`

Handled like every other config key, with no special case:

- **Listing:** a `restart-on-update` row after `bind`, with source `file` or `default` (value
  `ask`), or `file, invalid`.
- **Single read:** `kerghan configure restart-on-update` prints the effective value (`ask` when
  unset).
- **Set:** `kerghan configure restart-on-update=always` validates with
  `valid_restart_on_update`; an invalid value is refused (exit `1`) with the same expected text.
- **Unset:** `kerghan configure --unset restart-on-update` removes the line, so the default
  applies again.

### Apply hint

The setting applies to the next `kerghan update`, not to the running instance, so it needs no
restart. The [apply hint](../../standalone/client-config.md#apply-hint) gains one row:

| Keys changed | Hint |
|--------------|------|
| Only `restart-on-update` | `Takes effect on the next 'kerghan update'.` |

When other keys changed in the same call, the strongest hint of those keys is printed instead
(`down && up` still covers everything), and this line is not printed.

## `kerghan wizard`

Always asked, also without `--advanced`, right after `bind`: the last config question, before
the default-user questions. The question list of
[Client config: wizard](../../standalone/client-config.md#questions) becomes:

| # | Question | Key | File |
|---|----------|-----|------|
| 1–7 | unchanged | `port` … `bind` | config |
| 8 | Restart after update (ask / always / never) | `restart-on-update` | config |
| 9 + | Default user enabled (true / false) | `KERGHAN_DEFAULT_USER_ENABLED` | env |
| 10 + | Default user is admin (true / false) | `KERGHAN_DEFAULT_USER_ADMIN` | env |
| 11 | Default user username | `KERGHAN_DEFAULT_USER_USERNAME` | env |
| 12 | Default user email | `KERGHAN_DEFAULT_USER_EMAIL` | env |
| 13 | Default user password (keep / generate / type) | `KERGHAN_DEFAULT_USER_PASSWORD` | env |
| 14 + | Public URL | `FRONTEND_BASE_URL` | env |

The skip rule of the default-user questions keeps its meaning (they become 10–13).

The exact label is `Restart after update (ask/always/never)`, with the bracket convention of the
other config questions (the current value, or the default when the key has no line):

```
Bind address [127.0.0.1, derived from auto-login]:
Restart after update (ask/always/never) [ask]:
```

- **Enter keeps the bracketed value;** with no line in `config`, nothing is written.
- **An invalid answer** (e.g. `yes`) is re-asked after the validator's message. It is not a
  boolean key: `y` / `n` are not translated.
- **An invalid current value** is shown as invalid with the default offered:
  `Restart after update (ask/always/never) [ask] (current value 'yes' is invalid):`. Enter then
  writes `ask`, which fixes the line.

## Usage and `config.example`

The `usage` settings list gains one line after `bind=` (verbatim, `$DEFAULT_RESTART_ON_UPDATE`
expanding to `ask`):

```
  restart-on-update=$DEFAULT_RESTART_ON_UPDATE  ask | always | never (overridden by update --[no-]restart)
```

and the paragraph after the list ends with one more sentence (verbatim):

```
A changed restart-on-update applies to the next 'kerghan update'.
```

`standalone/config.example` gains this entry after `bind` (verbatim):

```
# What `kerghan update` does with a running instance once the new client and
# image are installed: ask | always | never.
#   ask     prompt "Restart Kerghan now? [Y/n]" (without a terminal: like never)
#   always  restart it, like `kerghan up` (the data volume is kept)
#   never   leave it running; `kerghan up` restarts it later
# A stopped instance is never started, and a downgrade never restarts.
# Overridden by `kerghan update --restart` / `kerghan update --no-restart`.
#restart-on-update=ask
```

## Older clients

A client older than this setting (any 0.8.x, or a version a downgrade installs) does not know
the key:

- every command that loads the config (`up`, `down`, `reset`, `update-env`) warns
  `/home/me/.kerghan/config:9: unknown key 'restart-on-update' (ignored)` and carries on;
- its `kerghan configure` lists the key as `unknown (ignored)` and refuses to write it.

This is accepted. The key is never removed automatically; the downgrade warning mentions it (see
[versions.md](versions.md#downgrade)).

## Required tests

In the existing bats files (`config.bats`, `configure.bats`, `configure_files.bats`,
`wizard.bats`):

- **Parser:** `ask`, `always` and `never` are accepted; an empty value uses `ask`; any other
  value (`yes`, `Always`, `true`) fails `load_config` with exit `1` and the
  `(expected ask, always or never)` message; a missing line uses `ask`.
- **`configure` listing:** the row appears after `bind` with source `default` / `file` /
  `file, invalid`.
- **`configure` read, set and unset:** the single read prints the effective value; each valid
  value is written; an invalid one is refused with exit `1` and nothing written; `--unset`
  removes the line.
- **Apply hint:** a change of only `restart-on-update` prints
  `Takes effect on the next 'kerghan update'.`; together with `port` it prints the `kerghan up`
  hint instead.
- **Wizard:** the question is asked right after `bind`, with and without `--advanced`; Enter
  keeps the current value (nothing written when unset); an invalid answer is re-asked; an
  invalid current line is offered as `[ask]` and fixed by Enter; `y` is refused, not
  translated.
- **Usage:** `kerghan help` lists `restart-on-update=ask` with its line.
- **`config.example`:** contains the `#restart-on-update=ask` entry.
