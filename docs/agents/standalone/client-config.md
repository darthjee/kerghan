# Standalone: client config (`kerghan configure` / `kerghan wizard`)

Part of [Standalone Distribution](../standalone.md). Defines the two client commands that read
and write the standalone settings and secrets, the writer they share, and their security rules.
Product decision: epic #402. Code: `standalone/bin/kerghan` (the "Shared config/env writer"
section, `configure` and the wizard). Tests: `standalone/test/configure_files.bats`,
`configure.bats`, `wizard.bats`, `configure_security.bats`.

- [Overview and scope](#overview-and-scope)
- [Exit codes and streams](#exit-codes-and-streams)
- [Files and the shared writer](#files-and-the-shared-writer)
- [`kerghan configure`](#kerghan-configure)
- [`kerghan wizard`](#kerghan-wizard)
- [Security](#security)

## Overview and scope

The standalone settings live in two files under `~/.kerghan/` (see
[Configuration](../standalone.md#configuration-kerghan)). Both can be edited by hand, or with:

- **`kerghan configure`**: direct and scriptable. Lists every value, reads one, sets one or more
  (`key=value`), or unsets one.
- **`kerghan wizard`**: interactive. One question per setting, with the current value as the
  default, then a summary and a confirmation before anything is written.

Both use one writer (key routing, validation, line editing, atomic writes) and one set of
secret-handling rules.

- **Both files.** `~/.kerghan/config` holds the client settings, all lower-case keys: `port`,
  `variant`, `runtime`, `stop-timeout`, `image-tag`, `auto-login`, `bind`.
  `~/.kerghan/kerghan.env` holds the container's environment, all upper-case keys (the two
  secrets, the `KERGHAN_DEFAULT_USER_*` values, `FRONTEND_BASE_URL`, any custom variable).
- **Routing by key.** The two namespaces never collide, so the key alone decides which file is
  written (see [Key routing](#key-routing)). There is no `--env` flag: the key's case already
  says which file it belongs to.
- **Write-only.** The commands only write the files and print what changed (`key: old -> new`),
  then the [apply hint](#apply-hint). They never run `kerghan up` and never start, stop or
  inspect containers; the only Docker call is the read-only volume check of
  [Missing files](#missing-files) case 3. Writing and applying stay separate on purpose: the
  apply hint says which command applies the change.
- **Same files as by hand.** Files written by these commands are read by `up`, `down`, `reset`
  and `update-env` exactly as hand-edited files are.

Out of scope:

- Running or recreating the instance (the user runs the printed apply hint).
- `KERGHAN_DEFAULT_USER_ALWAYS_AUTHENTICATED` and `KERGHAN_DEFAULT_USER_ALLOWED_IPS`: the client
  manages them itself on every `up` and refuses them in `kerghan.env` (see
  [Refused keys](#refused-keys)).
- A machine-readable listing (`--json`): scripts use the single read
  (`kerghan configure <key>`).
- Asking for the two secrets in the wizard.

Design notes:

- **Why `key=value`** rather than a git-config style `kerghan configure port 3002`: several keys
  can be set in one all-or-nothing call.
- **Why a separate `configure`** rather than a wizard-only design: `configure` is scriptable, and
  the wizard is a thin interactive layer over the same writer.

## Exit codes and streams

Shared by both commands, following the client's existing conventions:

| Case | Exit |
|------|------|
| Success | `0` |
| Wizard summary answered `n` (prints `Nothing written.`) | `0` |
| Usage error (unknown option, malformed argument, `--unset` without a key) — prints usage | `2` |
| Refusal (invalid value, refused or unknown key, missing `kerghan.env` with a data volume, no TTY for the wizard, declined `--force` confirmation) | `1` |
| Ctrl-C | `130` |

- **stdout:** values (listing, single read), the change list and the apply hint.
- **stderr:** errors, warnings and hints, through the client's `error` / `warn` / `hint` helpers
  (`kerghan: error: …`, `kerghan: warning: …`, `kerghan: hint: …`), and usage errors through
  `usage_error`. Wizard prompts also go to stderr, like the `reset` confirmation, so stdout stays
  clean.

**A refusal writes nothing:** every check (all keys, all values, missing files) runs before the
first write.

## Files and the shared writer

### The two files

| File | Keys | Read by | Mode |
|------|------|---------|------|
| `~/.kerghan/config` | lower-case: `port`, `variant`, `runtime`, `stop-timeout`, `image-tag`, `auto-login`, `bind` | the client's `load_config` (`up`, `down`, `reset`, `update-env`) | whatever it has (usually `644`) |
| `~/.kerghan/kerghan.env` | upper-case: any environment variable | Docker's env-file parser, through Vault, on `up` | `600` |

When the commands read a value, they read it the way its consumer does:

- **`config`** (`load_config`): one `key=value` per line; everything from the first `#` to the
  end of the line is a comment; surrounding whitespace of the line, the key and the value is
  trimmed; blank lines are ignored; an empty value means "use the default"; for a repeated key
  the **last** line wins; a line without `=` or an invalid value fails with the line number; an
  unknown key only warns. Values are validated with the client's `valid_*` validators
  (`valid_port`, `valid_variant`, `valid_runtime`, `valid_stop_timeout`, `valid_image_tag`,
  `valid_bool` for `auto-login`, `valid_bind`).
- **`kerghan.env`** (Docker's env-file parser): one `KEY=value` per line; a line starting with
  `#` is a comment; leading whitespace before the key is ignored; the value is **literal** (no
  quoting, no escaping, no trimming, `#` is part of the value); a bare `KEY` line (no `=`) takes
  the value from the host environment; for a repeated key the last line wins.

#### Known env keys

- The generated keys, `DEFAULT_ENV_KEYS` in the client: `KERGHAN_SECRET_KEY`,
  `KERGHAN_INTEGRATIONS_KEY`, `KERGHAN_DEFAULT_USER_ENABLED`, `KERGHAN_DEFAULT_USER_USERNAME`,
  `KERGHAN_DEFAULT_USER_EMAIL`, `KERGHAN_DEFAULT_USER_PASSWORD`, `KERGHAN_DEFAULT_USER_ADMIN`.
- The client-managed pair, `KERGHAN_DEFAULT_USER_ALWAYS_AUTHENTICATED` and
  `KERGHAN_DEFAULT_USER_ALLOWED_IPS`: always refused (see [Refused keys](#refused-keys)).
- `FRONTEND_BASE_URL`: optional; when `kerghan.env` does not set it, `up` passes
  `http://localhost:<port>`.

Any other upper-case key is a **custom** env variable: accepted and written verbatim.

### Key routing

- A key made only of upper-case letters, digits and `_`, starting with a letter or `_`
  (`[A-Z_][A-Z0-9_]*`), is an **env key** → `kerghan.env`.
- A key made only of lower-case letters, digits and `-`, starting with a letter
  (`[a-z][a-z0-9-]*`), is a **config key** → `config`. Only the seven known config keys are
  accepted (see [Existing content](#existing-content), case 7).
- Any other key (mixed case, other characters, empty) is a malformed argument: usage error,
  exit `2`.

### Missing files

A read (listing, single read, the wizard's defaults) never creates a file. Only a write does.

1. **No `config`.** The listing shows every config key with its default. The first write of a
   config key creates the file (with the user's umask), holding only the written line(s).
2. **No `kerghan.env`, no data volume** (`vault-kerghan-data`, checked with `volume_exists`).
   The first write of an env key first creates `kerghan.env` exactly as `up` does
   (`ensure_env_file`: generated secrets and default user, mode `600`, the same "Generated
   secrets…" message), then applies the change to it. The listing shows the env section as not
   created yet.
3. **No `kerghan.env`, data volume exists.** Any write of an env key is refused (exit `1`,
   nothing written, config keys in the same call included), with the same error and hint as
   `up` and `update-env`: restore `kerghan.env` from the backup (the data was written with its
   secrets), or run `kerghan reset`. A config-only write is not affected.

The volume check runs only in cases 2 and 3 (no `kerghan.env` and an env key to write).

### Existing content

4. **Invalid line in `config`** (an invalid value, or a line without `=`). The listing still
   works and marks the key `invalid` (a line without `=` is reported with its line number).
   Setting or unsetting that key fixes it (every line for the key is rewritten or removed). Any
   other write (another config key, or an env key) is refused (exit `1`, the line number and the
   `load_config` message), because `up` would still fail on the file. A line without `=` has no
   key the commands could fix: the error asks to fix the line by hand.
5. **Duplicate key** (either file). Setting rewrites the **last** line for the key (the
   effective one), removes the earlier copies, and warns that they were removed. `--unset`
   removes every copy.
6. **Commented-out key in `config`** (a `#key=…` line, e.g. `#port=3000` from
   `config.example`). When the key has no active line, setting it replaces the **first** such
   template line with `key=value`; the comment lines above it stay. With no template line
   either, the key is appended. `kerghan.env` keys are always appended when they have no active
   line (a `#KEY=` line in `kerghan.env` is left alone).
7. **Unknown keys.** An unknown lower-case key in a command is refused as a likely typo (exit
   `1`, listing the known config keys). Any upper-case key is accepted. Only known keys are
   validated: config keys with the `valid_*` validators, env keys as in [Values](#values). An
   unknown key already in `config` is kept untouched; the listing shows it as
   `unknown (ignored)`, as `load_config` warns about it.

### Values

8. **Characters.** A value containing a newline (or carriage return) is rejected for every key.
   A config value cannot contain `#` (it would start a comment). Env values are written exactly
   as given: no quoting, no trimming, `#` and spaces included.
9. **Empty values** (`port=`, `KERGHAN_DEFAULT_USER_EMAIL=`) are rejected for every key; use
   `--unset` to return a config key to its default or remove an env key.
10. **`--unset` of a generated env key** (one of `DEFAULT_ENV_KEYS`) is refused (exit `1`):
    `up` and `update-env` would regenerate it, so the unset would not stick, and for the secrets
    it would lose them. `--unset` of a config key, `FRONTEND_BASE_URL` or a custom env key is
    allowed. `--unset` of a key with no line is not an error: nothing changes.

Validation of known env keys (the others are only checked by rules 8–9):

| Key | Accepted |
|-----|----------|
| `KERGHAN_DEFAULT_USER_ENABLED`, `KERGHAN_DEFAULT_USER_ADMIN` | `true` or `false` (the backend treats anything other than `true` as off) |
| `KERGHAN_DEFAULT_USER_PASSWORD` | at least 8 characters (`PASSWORD_MIN_LENGTH`; the backend refuses to boot with a shorter one) |
| `FRONTEND_BASE_URL` | starts with `http://` or `https://` (the backend refuses to boot otherwise) |
| `KERGHAN_SECRET_KEY`, `KERGHAN_INTEGRATIONS_KEY` | any value, with `--force` (see [Changing the secrets](#changing-the-secrets)) |

### Writing

11. **Editing.** A key that already has a line keeps its line position; every other line
    (comments, blank lines, unrelated and unknown keys) is kept byte for byte. A new key is
    appended at the end, after adding a final newline when the file lacks one (as `update-env`
    does). The written file always ends with a newline.
    - **Atomic.** All checks of the whole call run first; then each file is written to a temp
      file in the **same directory**, created under umask `077`, and renamed into place. A
      failure before the rename leaves the original file untouched and removes the temp file. A
      call that changes both files writes `kerghan.env` first, then `config`.
    - **Permissions.** `kerghan.env` is `600` after every write (the temp file already is,
      before the rename). `config` keeps its existing mode; a new `config` gets the user's
      umask.
    - **Symlinks.** When a file is a symlink, the write goes through to its target (the temp
      file is created next to the target and renamed over it); the link itself is kept.

A key set to its current value is not a change. A call with no change writes nothing, prints
`Nothing changed.` and no apply hint, and exits `0`.

### Change list

Both commands print the changes they wrote on stdout, one line per key:

```
port: 3000 (default) -> 3002
bind: 0.0.0.0 -> 127.0.0.1
FRONTEND_BASE_URL: (not set) -> https://kerghan.example.com
KERGHAN_DEFAULT_USER_PASSWORD: changed
image-tag: 0.8.0 -> (default)
```

An unset value shows as `(default)` for a config key (with the default value in front, when it
has one) and `(not set)` for an env key; an env key read from a bare `KEY` line shows as
`(from environment)`. Secrets never show their values (see [Masking](#masking)).

### Apply hint

After the change list, both commands print the hint for the keys that changed:

| Keys changed | Hint |
|--------------|------|
| `port`, `variant`, `image-tag`, `auto-login`, `bind` | `Run 'kerghan up' to apply (recreates the instance; data is kept).` |
| `runtime`, `stop-timeout` | `Run 'kerghan down && kerghan up' to apply.` |
| Any env key | `Run 'kerghan down && kerghan up' to apply.` |

When several keys change, only the strongest hint is printed: `down && up` covers everything. A
change of `KERGHAN_DEFAULT_USER_PASSWORD` adds the [password change](#password-change) note.

### Required tests

Covered by `standalone/test/configure_files.bats`:

- Routing: upper-case key → `kerghan.env`, lower-case key → `config`, mixed case → exit `2`.
- Missing `config`: the listing shows defaults and creates nothing; the first config write
  creates `config` with only that line.
- Missing `kerghan.env`, no volume: an env write creates it with every `DEFAULT_ENV_KEYS` key
  plus the change, mode `600`. Volume exists: an env write exits `1` with the restore / `reset`
  hint and writes nothing (config keys in the same call included); a config-only write
  succeeds.
- No Docker call when `kerghan.env` exists.
- Invalid `config` line: listed `invalid`; setting that key fixes it; setting another key exits
  `1` with the line number; a line without `=` asks for a manual fix.
- Duplicates: a set rewrites the last line, removes earlier copies and warns; `--unset` removes
  every copy.
- `#port=3000` template line: uncommented in place (comment above kept, only the first of two
  changes, appended with none); a `#KEY=` line in `kerghan.env` is left alone.
- Unknown lower-case key exits `1`; unknown upper-case key is written verbatim; an unknown key
  already in `config` is kept and listed `unknown (ignored)`.
- Values: newline exits `1`; config value with `#` exits `1`; env value with `#` and spaces is
  verbatim; empty value exits `1` for both files.
- `--unset` of each `DEFAULT_ENV_KEYS` key exits `1`; of `FRONTEND_BASE_URL` / a custom key
  removes it; of a key with no line exits `0` and changes nothing.
- Known env validation: `KERGHAN_DEFAULT_USER_ENABLED=yes`, a 7-character password and
  `FRONTEND_BASE_URL=ftp://x` exit `1`.
- Editing keeps line positions and other lines byte for byte; a missing final newline is added
  before appending.
- Modes: `kerghan.env` stays `600`; a `640` `config` stays `640`.
- A failed write leaves the original untouched and no temp file; a symlinked `config` is written
  through and stays a symlink.
- Same value: `Nothing changed.`, mtime unchanged, no apply hint.
- Change list `(default)` / `(not set)`; apply hint: `port` → `kerghan up` hint; `runtime`, any
  env key, or `port` + `runtime` → only the `down && up` hint; a password change adds the note.

## `kerghan configure`

### Usage

```
  configure [--show-secrets] [KEY]
                                  list the settings in ~/.kerghan/config and kerghan.env, or print KEY
  configure [--force] [--unset KEY]... [KEY=VALUE | KEY=-]...
                                  set or unset settings (all or nothing); KEY=- reads the value hidden
```

| Form | Arguments | Options allowed |
|------|-----------|-----------------|
| List | none | `--show-secrets` |
| Single read | exactly one bare `KEY` | `--show-secrets` |
| Write | one or more `KEY=VALUE` / `KEY=-` and/or `--unset KEY` (repeatable) | `--force` |

Options and arguments may come in any order. Usage errors (exit `2`, usage on stderr):

- an unknown option;
- `--unset` without a key, or `--unset` with a `KEY=VALUE` argument;
- more than one bare `KEY`, or a bare `KEY` mixed with writes;
- `--show-secrets` with a write, or `--force` with a list or single read;
- the same key twice in one write (set twice, or set and unset);
- more than one `KEY=-` in one call (stdin can feed only one);
- a malformed key (see [Key routing](#key-routing)).

### List

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

- **config rows:** always the seven keys, in this order, then any unknown key found in the file
  (source `unknown (ignored)`).
- **env rows:** the `DEFAULT_ENV_KEYS` keys in their order, then `FRONTEND_BASE_URL`, then every
  other key in file order. A client-managed key found in the file is listed with source
  `file, refused (client-managed)`.
- When `kerghan.env` does not exist, the env section has one line saying it is not created yet
  and that `kerghan up` (or the first env write) creates it.

| Source | Meaning |
|--------|---------|
| `file` | set by a line in the file (the last one, for a duplicate) |
| `default` | no line, or an empty value in `config`: the built-in default applies (shown in the value column; `image-tag` shows the pinned `KERGHAN_VERSION`) |
| `derived (...)` | the default depends on another value: `bind` → `derived (auto-login on)` / `derived (auto-login off)`; `auto-login` → `derived (no default user in kerghan.env)` when its default falls back to `false`, as `up` does |
| `not set` | env key with no line; the value column shows `—` |
| `, invalid` | appended to `file` for a `config` value its validator rejects |
| `, from environment` | appended to `file` for a bare `KEY` line in `kerghan.env` (value `—`) |

A `config` line without `=` is reported on stderr with its line number (`load_config`'s message,
as a warning); the listing still prints. Secrets are masked (see [Masking](#masking)) unless
`--show-secrets`.

### Single read

`kerghan configure <KEY>` prints only the raw value of the key, on one line, and exits `0`. This
is the scripting interface.

- The value is the one in the file (the effective line). When the key has no line (or an empty
  value in `config`), it prints an empty line and exits `0`: the default applies.
- A masked key prints `******** (set)` (or an empty line when unset) unless `--show-secrets`.
- An unknown lower-case key exits `1`, as for a write. An unknown upper-case key with no line
  prints an empty line.

### Write

`kerghan configure KEY=VALUE [KEY=VALUE...]` (with any `--unset KEY`):

1. Validate every key and value, and every rule of
   [Files and the shared writer](#files-and-the-shared-writer). Any failure: exit `1`, nothing
   written, every problem reported.
2. Write all changes (atomically per file, see [Writing](#writing)).
3. Print the [change list](#change-list) in argument order, then the [apply hint](#apply-hint),
   then any [cross-key warning](#cross-key-warnings).

A value is split at the first `=`: `FRONTEND_BASE_URL=https://a.example/?x=1` is valid.

#### `KEY=-`

Reads the value instead of taking it from the command line; works for any key.

- **On a TTY:** prompts `KEY: ` on stderr with echo off, then asks again to confirm; on a
  mismatch it says so and asks both again. Ctrl-C exits `130` and writes nothing.
- **From a pipe** (stdin is not a TTY): reads the first line of stdin, without its trailing
  newline. End of input with no line is an empty value (rejected).

The value read goes through the same validation as `KEY=VALUE`.

#### `--unset KEY`

Removes every line of the key (duplicates included); a config key goes back to its default.
Restrictions: [Values](#values), case 10.

#### `--show-secrets` and `--force`

- `--show-secrets` unmasks the password and the two secrets in the list and the single read.
- `--force` is required to set `KERGHAN_SECRET_KEY` or `KERGHAN_INTEGRATIONS_KEY`; without it the
  write is refused (exit `1`). See [Changing the secrets](#changing-the-secrets).

### Refused keys

`KERGHAN_DEFAULT_USER_ALWAYS_AUTHENTICATED` and `KERGHAN_DEFAULT_USER_ALLOWED_IPS` are managed by
the client on every `up`. Setting either is refused (exit `1`) with the same hint as `up`'s
`refuse_client_managed_keys`: use `auto-login` (`--[no-]auto-login`) and `bind` (`--bind`)
instead. `--unset` of either is allowed, so a user can remove a line `up` refuses.

### Required tests

Covered by `standalone/test/configure.bats`:

- No files: lists the seven config keys as `default` (bind `derived (auto-login on)`) and the env
  section as not created; creates nothing.
- Every source appears where it applies: `file`, `default`, `derived (auto-login off)`,
  `not set`, `file, invalid`, `unknown (ignored)`, `file, from environment`,
  `file, refused (client-managed)`; without a default user, `auto-login` is
  `false  derived (no default user in kerghan.env)`.
- The list masks the password and both secrets; `--show-secrets` shows them.
- Single read: `port` prints `3001` with `port=3001`, an empty line (exit `0`) without it; the
  password prints `******** (set)`; `portt` exits `1`.
- `port=3002` writes the line, prints `port: 3000 (default) -> 3002` and the `kerghan up` hint;
  `port=3002 auto-login=false` writes both; `port=3002 runtime=bad` exits `1` and leaves
  `config` byte for byte unchanged; a config + env call writes both files.
- `FRONTEND_BASE_URL=https://a.example/?x=1` keeps the second `=`.
- `printf 'secret-pw\n' | … KERGHAN_DEFAULT_USER_PASSWORD=-` writes `secret-pw` without the
  newline; empty stdin exits `1`.
- `--unset port` prints `port: 3002 -> 3000 (default)`.
- Setting either client-managed key exits `1` with the auto-login / bind hint; `--unset` removes
  it. `KERGHAN_SECRET_KEY=x` without `--force` exits `1`.
- Usage errors exit `2`: unknown option, `--unset` alone, two bare keys, a bare key with a set,
  `--show-secrets port=1`, `--force port`, `port=1 port=2`, `port=1 --unset port`, two `KEY=-`,
  `Port=1`.
- No call runs `vault` or recreates the instance.

## `kerghan wizard`

### Usage

```
  wizard [--advanced]             set up the settings interactively (--advanced asks every setting)
```

Any other option or argument is a usage error (exit `2`). The wizard writes through the same
writer as `kerghan configure`, so every rule of
[Files and the shared writer](#files-and-the-shared-writer) applies.

### Questions

Asked in this order; `+` marks the questions only asked with `--advanced`:

| # | Question | Key | File |
|---|----------|-----|------|
| 1 | Port | `port` | config |
| 2 | Image variant (online / offline) | `variant` | config |
| 3 + | Docker runtime (auto / sysbox / privileged) | `runtime` | config |
| 4 + | Stop timeout (seconds) | `stop-timeout` | config |
| 5 + | Image tag | `image-tag` | config |
| 6 | Automatic login (true / false) | `auto-login` | config |
| 7 | Bind address | `bind` | config |
| 8 + | Default user enabled (true / false) | `KERGHAN_DEFAULT_USER_ENABLED` | env |
| 9 + | Default user is admin (true / false) | `KERGHAN_DEFAULT_USER_ADMIN` | env |
| 10 | Default user username | `KERGHAN_DEFAULT_USER_USERNAME` | env |
| 11 | Default user email | `KERGHAN_DEFAULT_USER_EMAIL` | env |
| 12 | Default user password (keep / generate / type) | `KERGHAN_DEFAULT_USER_PASSWORD` | env |
| 13 + | Public URL | `FRONTEND_BASE_URL` | env |

- **`bind` after `auto-login`.** When `bind` has no line in `config`, its bracketed default is
  the one derived from the auto-login answer (`127.0.0.1` when on, `0.0.0.0` when off).
- **Skipping the default user.** When automatic login ends up off **and**
  `KERGHAN_DEFAULT_USER_ENABLED` is `false` (its answer with `--advanced`, its current value
  otherwise), nothing uses the default user: questions 9–12 are skipped. There is no conflict
  check between the two: automatic login implies an enabled default user (see
  [Default user: configuration](../modules/auth/default-user.md#configuration)).
- **Public URL.** Asked as `Public URL [http://localhost:<port>, derived from port]` (with the
  port answer) when `kerghan.env` has no `FRONTEND_BASE_URL`, or with its current value. Enter
  keeps the current value; nothing is written when it was never set.
- **Never asked:** `KERGHAN_SECRET_KEY`, `KERGHAN_INTEGRATIONS_KEY` (see
  [Changing the secrets](#changing-the-secrets)), the client-managed pair, and custom env
  variables. Those are handled by `kerghan configure` only.

### Prompts

Each prompt shows the current value (or the default) in brackets; prompts go to stderr, answers
are read from stdin.

```
Port [3000]: 3002
Image variant (online/offline) [online]:
Automatic login (true/false) [true]: false
Bind address [0.0.0.0, derived from auto-login]:
Default user username [admin]:
Default user email [admin@kerghan.local]: me@example.com
Default user password: (k)eep, (g)enerate or (t)ype? [k]:
```

- **Enter keeps the bracketed value.** When the key has no line (the default applies), Enter
  writes nothing: the key stays unset, so a later change of the default still reaches it. An env
  key with no line shows `not set`, and one from a bare `KEY` line shows `(from environment)`.
- **An invalid answer re-asks** the same question, after the validator's message on stderr (the
  `valid_*` validators for config keys, the known env key rules of [Values](#values)). An empty
  answer is never invalid: it is Enter.
- **An invalid current value** ([Existing content](#existing-content) case 4) is shown as invalid
  and the default is offered instead: `Port [3000] (current value 'abc' is invalid):`. Enter then
  writes the default, which fixes the line.
- **Booleans** accept `true` / `false` (and `y` / `n`, written as `true` / `false`).

#### Password

- **(k)eep** (the default): no change.
- **(g)enerate:** a new password from the same generator as `up` (48 hex characters). It is never
  printed; after the write the wizard says the new password is in `~/.kerghan/kerghan.env`.
- **(t)ype:** asked with hidden input, twice; a mismatch says so and asks both again; a password
  shorter than 8 characters is re-asked.

When `kerghan.env` has no password (a file from an older client, or no file yet), `keep` is not
offered and the default is `(g)enerate`.

### Starting state

Checked before the first question; any failure exits `1` and asks nothing:

- **No TTY.** Without a terminal on stdin the wizard fails with an error pointing to
  `kerghan configure` for scripted changes.
- **No `kerghan.env` with a data volume** ([Missing files](#missing-files) case 3): the restore /
  `kerghan reset` hint, plus a pointer to `kerghan configure` for config-only changes.
- **A `config` line without `=`**: the line number and a request to fix it by hand.

With no `kerghan.env` and no data volume, the env questions offer the values a new file gets
(username `admin`, email `admin@kerghan.local`, a generated password); the write creates the file
as `up` does and applies the answers ([Missing files](#missing-files) case 2).

The TTY check is a single helper, `is_tty` (stdin is a terminal), also used by `configure`'s
`KEY=-` and `--force` confirmation. Tests drive the wizard through stdin with the test-only
override `KERGHAN_ASSUME_TTY=true`, which makes that helper answer "terminal"; it is not listed
in the usage or the user docs.

### Summary and confirmation

Nothing is written while the questions run: the answers stay in memory until the confirmation.
After the last question the wizard prints the [change list](#change-list) (secrets as
`<KEY>: changed`, see [Masking](#masking)) and asks:

```
port: 3000 (default) -> 3002
auto-login: true (default) -> false
KERGHAN_DEFAULT_USER_EMAIL: admin@kerghan.local -> me@example.com
Write these changes? [Y/n]
```

- **`Y` / Enter:** writes everything (all or nothing, see [Writing](#writing)), then prints the
  apply hint and any [cross-key warning](#cross-key-warnings).
- **`n`:** prints `Nothing written.` and exits `0`.
- **No change at all:** prints `Nothing changed.` and exits `0` without asking.

### Abort

- **Ctrl-C** at any point before the write: nothing is written, exit `130`.
- **End of input** before the confirmation: nothing is written, an error says the input ended,
  exit `1`.
- **A running instance** needs no special handling: the wizard never touches it, and the apply
  hint says how to apply the change.

### Required tests

Covered by `standalone/test/wizard.bats`, driven through stdin with `KERGHAN_ASSUME_TTY=true`
unless stated:

- Without `KERGHAN_ASSUME_TTY` and with piped stdin: exit `1` pointing to `kerghan configure`, no
  question printed. An unknown option exits `2`.
- Without `--advanced`, questions 1, 2, 6, 7, 10, 11, 12 in that order; with it, all thirteen.
- Enter on every question with no `config` writes nothing and prints `Nothing changed.`.
- Port `3002` + confirm writes `port=3002`, prints the change list and the `kerghan up` hint.
- The `bind` default follows the auto-login answer; Enter on it writes no `bind` line.
- Auto-login `false` with `KERGHAN_DEFAULT_USER_ENABLED=false` skips the default user
  questions; auto-login `true` asks them.
- An invalid port re-asks; an invalid `runtime` line is shown invalid with the default offered,
  and Enter writes the default.
- Password: `g` writes 48 hex characters, never prints them, and says where they are; `t` with
  two matching answers writes it; a mismatch and a 7-character password re-ask; with no
  password in `kerghan.env`, `keep` is not offered. The summary shows
  `KERGHAN_DEFAULT_USER_PASSWORD: changed`.
- `--advanced` public URL: Enter with no `FRONTEND_BASE_URL` writes nothing; an answer writes it.
- `n` prints `Nothing written.`, exits `0`, both files byte for byte unchanged. End of input
  after question 2 writes nothing and exits `1`.
- No `kerghan.env`, no volume: created as `up` does with the answers applied; with a volume:
  exit `1` before the first question.
- The secrets are never asked; no `vault` call.

## Security

`kerghan.env` holds the instance's secrets and is the **source of truth for the default user**:
on every boot the backend creates or synchronizes that user from it, and a password change
revokes the user's sessions (see
[Default user: boot sync](../modules/auth/default-user.md#boot-sync)). So writing
`KERGHAN_DEFAULT_USER_PASSWORD` rotates the admin password on the next boot, and writing the two
secrets changes keys the stored data depends on.

### Masking

Secret keys: `KERGHAN_DEFAULT_USER_PASSWORD`, `KERGHAN_SECRET_KEY`, `KERGHAN_INTEGRATIONS_KEY`.

- **Listing:** a set secret shows `********` in the value column (the source still says `file`);
  an unset one shows `—` / `not set`, as any env key.
- **Single read:** a set secret prints `******** (set)`; an unset one an empty line.
- **`--show-secrets`** unmasks both (configure only; the wizard never shows them).
- **Change list** (configure output and wizard summary): a secret prints `<KEY>: changed`
  (`<KEY>: changed (generated)` for a wizard-generated password), never `old -> new`, and never
  the value. `--unset` is refused for all three (they are generated keys, [Values](#values)
  case 10).
- Secrets never appear in an error or warning message, including validation errors (the
  password-length error names the key and the minimum, not the value).

### Inline secrets

`kerghan configure KEY=value` works for a secret key, but prints a hint on stderr that the value
may be kept in the shell history and visible in `ps`, and that `KEY=-` reads it hidden instead
(see [`KEY=-`](#key-)). The hint never stops the write.

### Changing the secrets

`KERGHAN_SECRET_KEY` and `KERGHAN_INTEGRATIONS_KEY` are only written with `--force` (configure);
the wizard never asks for them. Without `--force` the write is refused (exit `1`) and nothing in
the call is written.

With `--force`, before writing, a warning on stderr says that changing them logs everyone out
(`KERGHAN_SECRET_KEY` signs every access token) and makes stored integration credentials
unreadable (`KERGHAN_INTEGRATIONS_KEY` encrypts them, see
[integrations](../modules/integrations.md)), and to back up `kerghan.env` first. Then:

- **On a TTY:** asks `Continue? [y/N]` on stderr; anything but `y` / `yes` exits `1` and writes
  nothing.
- **Without a TTY:** `--force` alone is enough; the warning is still printed.

### Cross-key warnings

Checked on the values after the write (file values plus the ones the call set), printed on stderr
after the apply hint; they never stop the write:

- **`auto-login` on with a non-loopback `bind`** (outside `127.0.0.0/8`): the same warning and
  hint `up` prints (anyone who can reach the port is logged in as admin; use
  `kerghan up --no-auto-login` or set `bind=127.0.0.1`).
- **`auto-login=true` without default-user credentials** (`auto-login=true` is set in
  `config`, `kerghan.env` exists and lacks a value for `KERGHAN_DEFAULT_USER_USERNAME`,
  `KERGHAN_DEFAULT_USER_EMAIL` or `KERGHAN_DEFAULT_USER_PASSWORD`): a warning that `kerghan up`
  will fail, with the `kerghan update-env` hint `up` gives. Not printed when the same call sets
  the missing ones.

### Password change

When `KERGHAN_DEFAULT_USER_PASSWORD` changes, the apply hint adds a note: on the next boot the
admin password changes and the default user's existing sessions are revoked (logged-in browsers
must log in again, or are logged in again automatically when auto-login is on).

### File safety

- The `kerghan.env` temp file is created under umask `077`, so it is mode `600` before it holds
  any value and before the rename; the result stays `600`.
- The temp file lives in the same directory as its target (the symlink target, for a symlink),
  so the rename is atomic and never crosses file systems.
- A failed write removes the temp file; no partial file is left with secrets in it.

### Docker footprint

Neither command starts, stops or inspects a container, and neither calls `vault`. The only Docker
call is the read-only volume check of [Missing files](#missing-files) case 3, made only when
`kerghan.env` is missing and the call writes an env key (or the wizard starts).

### Required tests

Covered by `standalone/test/configure_security.bats` (wizard-specific cases in `wizard.bats`):

- The listing masks the password and both secrets; the single read prints `******** (set)`;
  `--show-secrets` shows the values.
- Setting the password prints `KERGHAN_DEFAULT_USER_PASSWORD: changed` and never the old or new
  value on stdout or stderr; a password-length error does not contain the value.
- `KERGHAN_DEFAULT_USER_PASSWORD=value` prints the `KEY=-` hint and still writes.
- `KERGHAN_SECRET_KEY=x`: without `--force` exits `1` and writes nothing; with `--force` and no
  TTY warns and writes; with `KERGHAN_ASSUME_TTY=true`, `n` exits `1` and writes nothing, `y`
  writes.
- `auto-login=true bind=0.0.0.0` writes both and prints `up`'s non-loopback warning.
- `auto-login=true` without the default user warns that `up` will fail; with the three
  credentials in the same call it does not.
- A password change adds the sessions-revoked note.
- The written `kerghan.env` is mode `600`; a write failing after the temp file is created leaves
  no temp file.
- With `kerghan.env` present, neither command calls `docker` or `vault`.
