# Client config: `kerghan configure`

The direct, scriptable command: list every value, read one, set or unset one or more. Part of
the [client config specs](README.md). File rules (routing, validation, writing, apply hint) are
in [files.md](files.md); secret handling in [security.md](security.md).

## Usage

The client `usage` gets these lines in its "Commands:" list, verbatim (#404 copies them), after
`update-env`:

```
  configure [--show-secrets] [KEY]
                                  list the settings in ~/.kerghan/config and kerghan.env, or print KEY
  configure [--force] [--unset KEY]... [KEY=VALUE | KEY=-]...
                                  set or unset settings (all or nothing); KEY=- reads the value hidden
```

The call is one of three forms, decided by its arguments:

| Form | Arguments | Options allowed |
|------|-----------|-----------------|
| List | none | `--show-secrets` |
| Single read | exactly one bare `KEY` | `--show-secrets` |
| Write | one or more `KEY=VALUE` / `KEY=-` and/or `--unset KEY` (repeatable) | `--force` |

Usage errors (exit `2`, usage printed on stderr):

- an unknown option;
- `--unset` without a key, or `--unset` with a `KEY=VALUE` argument;
- more than one bare `KEY`, or a bare `KEY` mixed with writes;
- `--show-secrets` with a write, or `--force` with a list or single read;
- the same key twice in one write (set twice, or set and unset);
- more than one `KEY=-` in one call (stdin can feed only one);
- a malformed key (see [files.md](files.md#key-routing)).

Options and arguments may come in any order.

## List

`kerghan configure` prints every value, in two sections, with aligned columns (value, source):

```
config (~/.kerghan/config)
  port          3001        file
  variant       online      default
  runtime       sysbox2     file, invalid
  stop-timeout  60          default
  image-tag     0.8.1       default
  auto-login    true        default
  bind          127.0.0.1   derived (auto-login on)
env (~/.kerghan/kerghan.env)
  KERGHAN_SECRET_KEY              ********              file
  KERGHAN_INTEGRATIONS_KEY        ********              file
  KERGHAN_DEFAULT_USER_ENABLED    true                  file
  KERGHAN_DEFAULT_USER_USERNAME   admin                 file
  KERGHAN_DEFAULT_USER_EMAIL      admin@kerghan.local   file
  KERGHAN_DEFAULT_USER_PASSWORD   ********              file
  KERGHAN_DEFAULT_USER_ADMIN      true                  file
  FRONTEND_BASE_URL               —                     not set
  MY_CUSTOM_VAR                   hello                 file
```

Rows:

- **config:** always the seven keys, in this order, then any unknown key found in the file
  (source `unknown (ignored)`).
- **env:** the `DEFAULT_ENV_KEYS` keys in their order, then `FRONTEND_BASE_URL`, then every
  other key in the file in file order. A client-managed key found in the file is listed with
  source `file, refused (client-managed)`.
- When `kerghan.env` does not exist, the env section has one line saying it is not created yet
  and that `kerghan up` (or the first env write) creates it.

Sources:

| Source | Meaning |
|--------|---------|
| `file` | set by a line in the file (the last one, for a duplicate) |
| `default` | no line, or an empty value in `config`: the built-in default applies (shown in the value column; `image-tag` shows the pinned `KERGHAN_VERSION`) |
| `derived (...)` | the default depends on another value: `bind` → `derived (auto-login on)` / `derived (auto-login off)`; `auto-login` → `derived (no default user in kerghan.env)` when its default falls back to `false`, as `up` does |
| `not set` | env key with no line; the value column shows `—` |
| `, invalid` | appended to `file` for a `config` value its validator rejects |
| `, from environment` | appended to `file` for a bare `KEY` line in `kerghan.env` (value `—`) |

A `config` line without `=` is reported on stderr with its line number (`load_config`'s
message, as a warning); the listing still prints. Secrets and the password are masked (see
[security.md](security.md#masking)) unless `--show-secrets`.

## Single read

`kerghan configure <KEY>` prints only the raw value of the key, on one line, and exits `0`.
This is the scripting interface; there is no `--json`.

- The value is the one written in the file (the effective line). When the key has no line (or
  an empty value in `config`), it prints an empty line and exits `0`: the default applies.
- A masked key prints `******** (set)` (or an empty line when unset) unless `--show-secrets`.
- An unknown lower-case key exits `1`, as for a write. An unknown upper-case key with no line
  prints an empty line.

## Write

`kerghan configure KEY=VALUE [KEY=VALUE...]` (with any `--unset KEY`):

1. Validate every key and value, and every check of [files.md](files.md) (missing files,
   invalid lines, refused keys). Any failure: exit `1`, nothing written, every problem reported.
2. Write all changes (atomically per file, see [files.md](files.md#writing)).
3. Print the change list on stdout, one line per changed key in argument order
   (`key: old -> new`, see [files.md](files.md#change-list)), then the apply hint
   ([files.md](files.md#apply-hint)), then any cross-key warning
   ([security.md](security.md#cross-key-warnings)).

A value is split at the first `=`: `FRONTEND_BASE_URL=https://a.example/?x=1` is valid.

### `KEY=-`

Reads the value instead of taking it from the command line; works for any key.

- **On a TTY:** prompts `KEY: ` on stderr with echo off, then asks again to confirm; on a
  mismatch it says so and asks both again. Ctrl-C exits `130` and writes nothing.
- **From a pipe** (stdin is not a TTY): reads the first line of stdin, without its trailing
  newline. End of input with no line is an empty value (rejected).

The value read goes through the same validation as `KEY=VALUE`.

### `--unset KEY`

Removes every line of the key (duplicates included); a config key goes back to its default.
Restrictions (generated env keys, keys with no line) are in
[files.md](files.md#values), case 10.

### `--show-secrets` and `--force`

- `--show-secrets` unmasks the password and the two secrets in the list and the single read.
- `--force` is required to set `KERGHAN_SECRET_KEY` or `KERGHAN_INTEGRATIONS_KEY`; without it
  the write is refused (exit `1`). See
  [security.md](security.md#changing-the-secrets) for the confirmation it triggers.

## Refused keys

`KERGHAN_DEFAULT_USER_ALWAYS_AUTHENTICATED` and `KERGHAN_DEFAULT_USER_ALLOWED_IPS` are managed
by the client on every `up`. Setting either is refused (exit `1`) with the same hint as `up`'s
`refuse_client_managed_keys`: use `auto-login` (`--[no-]auto-login`) and `bind` (`--bind`)
instead. `--unset` of either is allowed, so a user can remove a line `up` refuses.

## Required tests

- `kerghan configure` with no files lists the seven config keys as `default` (bind
  `derived (auto-login on)`) and the env section as not created; creates nothing.
- The list shows `file`, `default`, `derived (auto-login off)` (with `auto-login=false`),
  `not set`, `file, invalid`, `unknown (ignored)`, `file, from environment` and
  `file, refused (client-managed)` where each applies.
- With a `kerghan.env` lacking the default user, `auto-login` is listed as
  `false  derived (no default user in kerghan.env)`.
- The list masks the password and both secrets; `--show-secrets` shows them.
- `kerghan configure port` prints `3001` with `port=3001`, and an empty line (exit `0`) without
  it; `kerghan configure KERGHAN_DEFAULT_USER_PASSWORD` prints `******** (set)`.
- `kerghan configure portt` exits `1`.
- `kerghan configure port=3002` writes the line, prints `port: 3000 (default) -> 3002` and the
  `kerghan up` hint, and exits `0`.
- `kerghan configure port=3002 auto-login=false` writes both; `port=3002 runtime=bad` exits `1`
  and leaves `config` byte for byte unchanged.
- A call setting a config key and an env key writes both files.
- `kerghan configure FRONTEND_BASE_URL=https://a.example/?x=1` keeps the second `=`.
- `printf 'secret-pw\n' | kerghan configure KERGHAN_DEFAULT_USER_PASSWORD=-` writes
  `secret-pw` without the newline; empty stdin exits `1`.
- `--unset port` removes the line and prints `port: 3002 -> 3000 (default)`.
- Setting `KERGHAN_DEFAULT_USER_ALWAYS_AUTHENTICATED` or `KERGHAN_DEFAULT_USER_ALLOWED_IPS`
  exits `1` with the auto-login / bind hint; `--unset` of either removes it.
- `KERGHAN_SECRET_KEY=x` without `--force` exits `1`.
- Usage errors exit `2` and print usage: unknown option, `--unset` alone, two bare keys, a bare
  key with a set, `--show-secrets port=1`, `--force port`, `port=1 port=2`,
  `port=1 --unset port`, two `KEY=-`, `Port=1`.
- No `configure` call runs `vault` or recreates the instance (the vault stub records no call).
