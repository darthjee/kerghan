# Writer: batch validation, atomic apply and reporting

Add the write side of the shared writer. It works on a batch of changes (set or unset, in
argument order), and is independent of `cmd_configure`.

- **Validate the whole batch** before any write, reporting every problem and returning failure
  (the caller exits `1`):
  - value rules (`files.md` "Values" 8–9): no newline / carriage return anywhere, no `#` in a
    config value, no empty value;
  - known-key validation: config keys with the `valid_*` validators; env keys per the table in
    `files.md` (`true`/`false`, password at least 8 characters, `FRONTEND_BASE_URL` starting with
    `http://` or `https://`). The password error names the key and minimum, never the value;
  - unknown lower-case key refused, listing the known keys (case 7);
  - client-managed pair: set refused with `refuse_client_managed_keys`' hint; unset allowed;
  - `--unset` of a `DEFAULT_ENV_KEYS` key refused (case 10); unset of a key with no line is a
    no-op, not an error;
  - the two secrets require the force flag (passed in by the caller);
  - invalid `config` lines (case 4): refuse any write unless every invalid key is set or unset in
    the batch; a line without `=` is always refused with a "fix the line by hand" error;
  - missing `kerghan.env` with an env key in the batch: call `volume_exists` (the only Docker
    call); with the volume, refuse with `up` / `update-env`'s error and restore / `reset` hint.
- **Apply a validated batch** (`files.md` "Writing" 11):
  - missing `kerghan.env` without the volume: call the existing `ensure_env_file` first (same
    "Generated secrets…" message), then apply the env changes to it;
  - per file, build the new content in memory: rewrite the last line of a key in place and remove
    earlier duplicates (with a warning), uncomment the first `#key=` template line in `config`
    when there is no active line (never in `kerghan.env`), append otherwise (adding a final
    newline first when missing), remove every line on unset; keep every other line byte for byte;
    always end with a newline;
  - compare with the current content: an unchanged file is not written (keeps mtime). A batch
    with no change prints `Nothing changed.` and no hint;
  - resolve symlinks to their final target (a `readlink` loop: `readlink -f` is not on older
    macOS), create the temp file next to the target under `umask 077` (`mktemp` in that
    directory), write it, set the mode (`600` for `kerghan.env`; the target's existing mode for
    `config`, or the user's umask for a new one), then `mv` it over the target. On any failure
    remove the temp file (a `trap` or explicit cleanup) and leave the original untouched;
  - write `kerghan.env` first, then `config`.
- **Report**: the change list on stdout in argument order (`key: old -> new`, `(default)` with
  the default value for config keys, `(not set)` for env keys, `<KEY>: changed` for secrets);
  then the strongest apply hint (`files.md` "Apply hint") plus the password-change note; then
  the cross-key warnings on stderr computed on the post-write values (`security.md` 12: the
  non-loopback warning `up` prints, and the missing default-user credentials warning with the
  `kerghan update-env` hint, skipped when the batch sets them).

## Files to Change
- `standalone/bin/kerghan` — batch globals, validation, line editing, atomic write, change list,
  apply hint, cross-key warnings.
