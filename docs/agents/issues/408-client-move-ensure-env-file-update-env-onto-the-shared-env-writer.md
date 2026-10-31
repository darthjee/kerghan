# Issue: Client: move ensure_env_file / update-env onto the shared env writer

## Description

Follow-up to #404. #404 added a shared atomic file writer to `standalone/bin/kerghan`
(`write_file_atomic`, with `resolve_symlink`), used by `configure` / `wizard`. Move the client's
older `kerghan.env` writing code onto it, so the file is written through one code path only.

## Problem

`ensure_env_file` and `cmd_update_env` write `~/.kerghan/kerghan.env` with their own logic:
`ensure_env_file` redirects into the file under `umask 077` and runs `chmod 600`; `cmd_update_env`
appends with `>>`, adds a final newline when one is missing and runs `chmod 600`. Neither write is
atomic: an interrupted or failed write can leave a truncated or half-appended `kerghan.env`, which
holds the secrets. #404 deliberately left these commands untouched, so there are now two code paths
writing the same file.

## Expected Behavior

- `ensure_env_file` (used by `up` and by `configure`/`wizard` batches that create the file) and
  `update-env` keep their visible behavior on success: same stdout/stderr, the same file contents
  byte for byte (existing content, order, trailing-newline fix, appended keys in
  `DEFAULT_ENV_KEYS` order), mode `600`, same exit codes.
- Both now write atomically through `write_file_atomic`: temp file in the target's directory
  under umask `077`, renamed into place; a failure leaves the original untouched, removes the temp
  file and exits non-zero with the writer's `could not write ...; it was left unchanged` error.
- A symlinked `kerghan.env` is written through to its target and stays a symlink (today's `>` /
  `>>` already follow the link; the gain is that the write is now atomic there too).
- Known, accepted change: the atomic rename gives `kerghan.env` a new inode on `update-env`.
  Harmless, since the file only reaches the container through `--env-file` at `up` time.

## Solution

- Rewrite the write paths of `ensure_env_file` and `cmd_update_env` on top of
  `write_file_atomic "$ENV_FILE" <content> 600`. For `update-env` the content is the existing file
  read byte for byte (beware `$(cat)` stripping trailing newlines), plus a newline when it lacks
  one, plus the generated lines. Only `write_file_atomic` is reused; `update-env` keeps building
  its own content (no `build_file_content` / batch).
- The existing bats suites (`update_env.bats`, `secrets.bats`, `install.bats`, …) pass unchanged.
  Add tests only for the newly gained behavior: symlinked `kerghan.env` (both commands), failed
  write leaves the original and no temp file.
- Docs: `docs/agents/standalone.md` (`update-env` section) drops the "inode is kept" promise and
  states the atomic write; `docs/agents/standalone/client-config.md` notes that `up` and
  `update-env` use the same writer.
- Owned by the standalone agent. Depends on #404 (merged).

## Benefits

- One code path writes `kerghan.env`, so permissions, atomicity and symlink rules cannot drift.
- `kerghan.env` (secrets) can no longer be left truncated by an interrupted write.
