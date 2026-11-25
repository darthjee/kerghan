# Client config: files and the shared writer

Part of [Client config](../client-config.md).

### The two files

| File | Keys | Read by | Mode |
|------|------|---------|------|
| `~/.kerghan/config` | lower-case: `port`, `variant`, `runtime`, `stop-timeout`, `image-tag`, `auto-login`, `bind`, `restart-on-update`, `file-logs`, `log-dir` | the client's `load_config` (`up`, `down`, `reset`, `update`, `update-env`) | whatever it has (usually `644`) |
| `~/.kerghan/kerghan.env` | upper-case: any environment variable | Docker's env-file parser, through Vault, on `up` | `600` |

When the commands read a value, they read it the way its consumer does:

- **`config`** (`load_config`): one `key=value` per line; everything from the first `#` to the
  end of the line is a comment; surrounding whitespace of the line, the key and the value is
  trimmed; blank lines are ignored; an empty value means "use the default"; for a repeated key
  the **last** line wins; a line without `=` or an invalid value fails with the line number; an
  unknown key only warns. Values are validated with the client's `valid_*` validators
  (`valid_port`, `valid_variant`, `valid_runtime`, `valid_stop_timeout`, `valid_image_tag`,
  `valid_bool` for `auto-login`, `valid_bind`, `valid_restart_on_update`).
- **`kerghan.env`** (Docker's env-file parser): one `KEY=value` per line; a line starting with
  `#` is a comment; leading whitespace before the key is ignored; the value is **literal** (no
  quoting, no escaping, no trimming, `#` is part of the value); a bare `KEY` line (no `=`) takes
  the value from the host environment; for a repeated key the last line wins.

#### Known env keys

- The generated keys, `DEFAULT_ENV_KEYS` in the client: `KERGHAN_SECRET_KEY`,
  `KERGHAN_INTEGRATIONS_KEY`, `KERGHAN_DEFAULT_USER_ENABLED`, `KERGHAN_DEFAULT_USER_USERNAME`,
  `KERGHAN_DEFAULT_USER_EMAIL`, `KERGHAN_DEFAULT_USER_PASSWORD`, `KERGHAN_DEFAULT_USER_ADMIN`.
- The client-managed keys, `KERGHAN_DEFAULT_USER_ALWAYS_AUTHENTICATED`,
  `KERGHAN_DEFAULT_USER_ALLOWED_IPS` and `KERGHAN_COOKIE_SECURE`: always refused (see [Refused keys](configure.md#refused-keys)).
- `FRONTEND_BASE_URL`: optional; when `kerghan.env` does not set it, `up` passes
  `http://localhost:<port>`.

Any other upper-case key is a **custom** env variable: accepted and written verbatim.

### Key routing

- A key made only of upper-case letters, digits and `_`, starting with a letter or `_`
  (`[A-Z_][A-Z0-9_]*`), is an **env key** → `kerghan.env`.
- A key made only of lower-case letters, digits and `-`, starting with a letter
  (`[a-z][a-z0-9-]*`), is a **config key** → `config`. Only the nine known config keys are
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
| `KERGHAN_SECRET_KEY`, `KERGHAN_INTEGRATIONS_KEY` | any value, with `--force` (see [Changing the secrets](security.md#changing-the-secrets)) |

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
    - **One writer.** These rules live in `write_file_atomic` (`bin/kerghan`), which is the
      only code path that writes `kerghan.env`: `ensure_env_file` (`up`, and a batch that
      creates the file) and `update-env` use it too, with mode `600`, so atomicity,
      permissions and symlink handling are the same for every command.

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
`(from environment)`. Secrets never show their values (see [Masking](security.md#masking)).

### Apply hint

After the change list, both commands print the hint for the keys that changed:

| Keys changed | Hint |
|--------------|------|
| `port`, `variant`, `image-tag`, `auto-login`, `bind`, `file-logs`, `log-dir` | `Run 'kerghan up' to apply (recreates the instance; data is kept).` |
| `runtime`, `stop-timeout` | `Run 'kerghan down && kerghan up' to apply.` |
| Any env key | `Run 'kerghan down && kerghan up' to apply.` |
| Only `restart-on-update` | `Takes effect on the next 'kerghan update'.` (see [Client update](../client-update.md#apply-hint)) |

When several keys change, only the strongest hint is printed: `down && up` covers everything. A
change of `KERGHAN_DEFAULT_USER_PASSWORD` adds the [password change](security.md#password-change) note.

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

