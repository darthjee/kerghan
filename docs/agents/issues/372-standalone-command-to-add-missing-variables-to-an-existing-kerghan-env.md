# Issue: Standalone: command to add missing variables to an existing kerghan.env

## Description
Part of #366. Builds against `docs/agents/specs/default-user/standalone.md` ("Existing installations"). Depends on #371 (merged).

Add a `kerghan` client command, `kerghan update-env`, that updates an existing `~/.kerghan/kerghan.env` created by an older client. It appends any variables the current `ensure_env_file` would write and the file lacks, in particular the `KERGHAN_DEFAULT_USER_*` ones with a generated password. It never changes existing values. Upgrading the client never modifies `kerghan.env` automatically; this command is the explicit way to do it.

## Problem
`ensure_env_file` (`standalone/bin/kerghan`) only writes `kerghan.env` when the file does not exist, so an installation created before #371 has no default user. On such an installation `kerghan up` turns automatic login off with a notice, and refuses an explicit `auto-login=true`. The only fix today is editing the file by hand.

## Expected Behavior
- `kerghan update-env` adds every key that `ensure_env_file` writes and that is missing from `kerghan.env`, with the same values a new installation gets (secrets from `openssl rand -base64 32`, `KERGHAN_DEFAULT_USER_PASSWORD` from `openssl rand -hex 24`, the fixed `admin` / `admin@kerghan.local` / `true` values).
- A key counts as present when the file has any line for it, including an indented, empty-value or bare `KEY` line, as in `refuse_client_managed_keys`. Present keys are never changed, and the command never adds a second copy.
- It appends only the missing keys at the end of the file. Existing content, order and mode (600) are preserved. When the file does not end with a newline, it adds one before appending.
- It never writes `KERGHAN_DEFAULT_USER_ALWAYS_AUTHENTICATED` or `KERGHAN_DEFAULT_USER_ALLOWED_IPS`, which the client manages itself.
- It prints the names of the keys it added, never their values (the password stays in the file), or says that nothing was missing.
- When it added something, it tells the user to run `kerghan down && kerghan up` to apply the change.
- When a key is present but blank (an empty value or a bare `KEY` line), the line is left as it is, and the command prints a warning that names the key. For a default-user credential, the warning adds that `up` will still treat the default user as missing.
- When `kerghan.env` does not exist, it fails (exit 1) and writes nothing. The hint says to run `kerghan up` for a new installation, or, when the `vault-kerghan-data` volume exists, to restore the file from a backup (new secrets would not match the data).
- It is idempotent: a second run adds nothing.
- It does not touch the Docker instance.

## Solution
- Use a single list of default keys and value generators, shared by `ensure_env_file` and `update-env`, so the two cannot drift apart.
- Add `cmd_update_env` and dispatch it from `main`.
- Update the `usage` text and the help.
- Point the `up` notice and the `auto-login=true` error hint for a `kerghan.env` without the default user at `kerghan update-env`.
- Update the comment in `standalone/config.example`, `docs/agents/standalone.md` and `docs/agents/specs/default-user/standalone.md` (record the command name).

## Acceptance criteria
- The command is implemented, with bats tests that cover: a missing file (with and without the data volume), an up-to-date file, a blank key (warned about and left as it is), a partially missing file, preserved values, order and mode, a file without a trailing newline, and a second run that adds nothing.
- Usage, help text and docs are updated.
