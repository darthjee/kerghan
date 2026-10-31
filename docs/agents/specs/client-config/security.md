# Client config: security

Secret handling and safety rules shared by `kerghan configure` and `kerghan wizard`. Part of the
[client config specs](README.md).

## Context

`kerghan.env` holds the instance's secrets and is the **source of truth for the default user**:
on every boot the backend creates or synchronizes that user from it, overwriting its email,
password and admin flag, and a password change revokes the user's sessions (see
[Default user: boot sync](../../modules/auth/default-user.md#boot-sync)). So writing
`KERGHAN_DEFAULT_USER_PASSWORD` with these commands rotates the admin password on the next
boot, and writing the two secrets changes keys the stored data depends on.

## Masking

Secret keys: `KERGHAN_DEFAULT_USER_PASSWORD`, `KERGHAN_SECRET_KEY`, `KERGHAN_INTEGRATIONS_KEY`.

- **Listing:** a set secret shows `********` in the value column (the source column still says
  `file`); an unset one shows `—` / `not set`, as any env key.
- **Single read:** a set secret prints `******** (set)`; an unset one an empty line.
- **`--show-secrets`** unmasks both (configure only; the wizard never shows them).
- **Change list** (configure output and wizard summary): a secret prints `<KEY>: changed`
  (`<KEY>: changed (generated)` for a wizard-generated password), never `old -> new`, and never
  the value. `--unset` is refused for all three (they are generated keys,
  [files.md](files.md#values) case 10).
- Secrets never appear in an error or warning message, including validation errors (the
  password-length error names the key and the minimum, not the value).

## Inline secrets

`kerghan configure KEY=value` keeps working for a secret key, but prints a hint on stderr that
the value may be kept in the shell history and visible in `ps`, and that `KEY=-` reads it
hidden instead ([configure.md](configure.md#key-)). The hint never stops the write.

## Changing the secrets

`KERGHAN_SECRET_KEY` and `KERGHAN_INTEGRATIONS_KEY` are only written with `--force`
(configure); the wizard never asks for them. Without `--force` the write is refused (exit `1`)
and nothing in the call is written.

With `--force`, before writing, a warning on stderr says that changing them logs everyone out
(`KERGHAN_SECRET_KEY` signs every access token) and makes stored integration credentials
unreadable (`KERGHAN_INTEGRATIONS_KEY` encrypts them, see
[integrations](../../modules/integrations.md)), and to back up `kerghan.env` first. Then:

- **On a TTY:** asks `Continue? [y/N]` on stderr; anything but `y` / `yes` exits `1` and writes
  nothing.
- **Without a TTY:** `--force` alone is enough; the warning is still printed.

The TTY check is the shared helper described in [wizard.md](wizard.md#starting-state).

## Cross-key warnings

Checked on the values after the write (file values plus the ones the call set), printed on
stderr after the apply hint; they never stop the write:

12. **`auto-login` on with a non-loopback `bind`** (outside `127.0.0.0/8`): the same warning and
    hint `up` prints (anyone who can reach the port is logged in as admin; use
    `auto-login=false` or `bind=127.0.0.1`).
    **`auto-login=true` without default-user credentials** (`kerghan.env` lacks a value for
    `KERGHAN_DEFAULT_USER_USERNAME`, `KERGHAN_DEFAULT_USER_EMAIL` or
    `KERGHAN_DEFAULT_USER_PASSWORD`): a warning that `kerghan up` will fail, with the
    `kerghan update-env` hint `up` gives. Not printed when the same call sets the missing ones.

## Password change

When `KERGHAN_DEFAULT_USER_PASSWORD` changes, the apply hint ([files.md](files.md#apply-hint))
adds a note: on the next boot the admin password changes and the default user's existing
sessions are revoked (logged-in browsers must log in again, or are logged in again
automatically when auto-login is on).

## File safety

- The `kerghan.env` temp file is created under umask `077`, so it is mode `600` before it holds
  any value and before the rename; the result stays `600`.
- The temp file lives in the same directory as its target (the symlink target, for a symlink),
  so the rename is atomic and never crosses file systems.
- A failed write removes the temp file; no partial file is left with secrets in it.

## Docker footprint

Neither command starts, stops or inspects a container, and neither calls `vault`. The only
Docker call is the read-only volume check of [files.md](files.md#missing-files) case 3, made only
when `kerghan.env` is missing and the call writes an env key (or the wizard starts).

## Required tests

- The listing shows `********` for the password and both secrets; the single read prints
  `******** (set)`; `--show-secrets` shows the values.
- Setting the password prints `KERGHAN_DEFAULT_USER_PASSWORD: changed` and never the old or new
  value on stdout or stderr.
- A password-length error does not contain the value.
- `KERGHAN_DEFAULT_USER_PASSWORD=value` prints the `KEY=-` hint and still writes.
- `KERGHAN_SECRET_KEY=x` without `--force` exits `1` and writes nothing; with `--force` and no
  TTY it prints the warning and writes; with `KERGHAN_ASSUME_TTY=true` and `n` it exits `1` and
  writes nothing; with `y` it writes.
- `auto-login=true bind=0.0.0.0` writes both and prints `up`'s non-loopback warning.
- `auto-login=true` with a `kerghan.env` lacking the default user writes and warns that `up`
  will fail; the same call with the three credentials does not warn.
- A password change adds the sessions-revoked note to the apply hint.
- The written `kerghan.env` is mode `600`, and a write failing after the temp file is created
  leaves no temp file.
- With `kerghan.env` present, neither command calls `docker` or `vault` (stubs record no call).
