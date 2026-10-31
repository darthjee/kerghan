# Standalone Plan: Client: move ensure_env_file / update-env onto the shared env writer

Main plan: [plan.md](plan.md)

## Overview
Rewrite the two remaining `kerghan.env` write paths in `standalone/bin/kerghan` on top of
`write_file_atomic "$ENV_FILE" <content> 600` (from #404). Only the writer is reused:
`update-env` keeps building its own content (no `build_file_content` / batch).

## Context
- `ensure_env_file` (`standalone/bin/kerghan`, ~line 357) writes under `umask 077` with `>`, then
  `chmod 600`. Callers: `cmd_up` (step "2. Secrets") and `batch_apply` (`configure`/`wizard`
  creating the file).
- `cmd_update_env` (~line 1753) appends with `>>`, adding a newline first when the file lacks one,
  then `chmod 600`.
- `write_file_atomic <path> <content> <mode|keep>` (~line 1309) resolves symlinks, writes a temp file
  next to the target under umask 077, chmods, renames; on failure it prints
  `could not write <target>; it was left unchanged`, removes the temp file and returns 1. It writes
  `<content>` with `printf '%s'`, so the caller supplies the trailing newline.
- Accepted by the user during refinement: the new inode on `update-env` (the file only reaches
  the container via `--env-file` at `up`), and reusing only `write_file_atomic`.

## Steps

- [01 — ensure_env_file on the writer](standalone/01-ensure-env-file.md)
- [02 — update-env on the writer](standalone/02-update-env.md)
- [03 — Tests and docs](standalone/03-tests-and-docs.md)

## CI Checks
- `standalone`: `docker-compose run --rm standalone_tests` (CI job: the `bats standalone/test` job
  on `bats/bats:1.11.0`). Also keep `shellcheck` clean on `standalone/bin/kerghan` if the CI lint
  job covers it.

## Notes
- Never run bats/shellcheck on the host; use docker-compose (CLAUDE.md).
- `set -euo pipefail` is on, but `set -e` is suspended inside a function called as part of an
  `||`/`if` chain (as `batch_apply` likely is), so failures must be propagated explicitly.
- Bash variables cannot hold NUL bytes; reading `kerghan.env` into a variable is fine for a text
  env file, but call this out in a comment.
- No existing bats test may change; if one fails, the rewrite has changed behavior and must be
  fixed, not the test.
