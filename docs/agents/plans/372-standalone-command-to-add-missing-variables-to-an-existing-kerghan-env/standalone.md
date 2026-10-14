# Standalone Plan: Standalone: command to add missing variables to an existing kerghan.env

Main plan: [plan.md](plan.md)

## Overview
Add `kerghan update-env`. It brings a `kerghan.env` created by an older client up to date by appending only the missing default keys. It warns about blank keys and leaves them as they are, and it refuses to run when the file does not exist. The list of default keys is shared with `ensure_env_file`, so the two cannot drift apart.

## Context
`ensure_env_file` (`standalone/bin/kerghan`) writes seven keys, and only when `kerghan.env` does not exist: `KERGHAN_SECRET_KEY` and `KERGHAN_INTEGRATIONS_KEY` (`openssl rand -base64 32`), `KERGHAN_DEFAULT_USER_ENABLED=true`, `KERGHAN_DEFAULT_USER_USERNAME=admin`, `KERGHAN_DEFAULT_USER_EMAIL=admin@kerghan.local`, `KERGHAN_DEFAULT_USER_PASSWORD` (`openssl rand -hex 24`) and `KERGHAN_DEFAULT_USER_ADMIN=true`. A file created before #371 has only the two secrets. On such a file `up` turns automatic login off with a notice, and refuses an explicit `auto-login=true` (`cmd_up`, after `refuse_client_managed_keys`). Decisions made in the issue: the command is called `update-env`; a missing file is an error; it covers every key `ensure_env_file` writes; a blank key is kept and gets a warning.

## Steps

- [01 — Shared default-key list](standalone/01-shared-default-keys.md)
- [02 — Add the update-env command](standalone/02-update-env-command.md)
- [03 — Point up's notice and hint at update-env](standalone/03-up-hints.md)
- [04 — Bats tests](standalone/04-bats-tests.md)
- [05 — Docs](standalone/05-docs.md)

## CI Checks
- `standalone`: `docker-compose run --rm standalone_tests` (CI job: `standalone_tests`, `bats standalone/test`)

## Notes
- Never run `bats` or `shellcheck` on the host; go through `docker-compose` (`standalone_tests` service).
- The bats image is `bats/bats` (BusyBox userland): use `stat -c %a` as the existing tests do, and keep the script portable to macOS bash 3.2 (no associative arrays, no `mapfile`), matching the rest of `bin/kerghan`.
- Adding a missing `KERGHAN_SECRET_KEY` / `KERGHAN_INTEGRATIONS_KEY` to an existing file is safe. The backend refuses to boot without them, so no running installation can hold data encrypted with a different value.
- "Present" means any line for the key: indented, with an empty value, or a bare `KEY` line. This matches `refuse_client_managed_keys`, so the command never adds a duplicate key, because which copy Docker uses is not certain.
- Never print generated values. The password stays only in the file.
