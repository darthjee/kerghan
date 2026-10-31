# Standalone Plan: Client: shared config/env writer + `kerghan configure`

Main plan: [plan.md](plan.md)

## Overview
Implement the shared config/env writer and `kerghan configure` in `standalone/bin/kerghan`,
exactly as defined in `docs/agents/specs/client-config/` (`README.md`, `files.md`,
`configure.md`, `security.md`). The specs are the source of truth for every message, exit
code, ordering and edge case; this plan only decides how the code is laid out.

## Context
- Users can only change settings by hand-editing the two files today. `load_config` reads
  `config` (and exits on invalid lines); Docker's env-file parser reads `kerghan.env`.
- Existing helpers to reuse: `valid_port`, `valid_variant`, `valid_runtime`,
  `valid_stop_timeout`, `valid_image_tag`, `valid_bool`, `valid_bind`, `is_loopback`, `trim`,
  `volume_exists`, `DEFAULT_ENV_KEYS`, `ensure_env_file`, `env_file_sets`,
  `has_default_user_credentials`, `error` / `warn` / `hint` / `usage_error`.
- Scope (from the issue): no changes to `up`, `down`, `reset`, `update-env` or
  `ensure_env_file` (their refactor onto the writer is #408); no wizard (#405); no permanent
  docs (#406); nothing outside `standalone/bin/kerghan` and `standalone/test/`.
- The client must stay bash 3.2 compatible (see the header of `standalone/bin/kerghan`): no
  associative arrays, no `mapfile`, no `${var,,}`, empty arrays expanded as
  `${arr[@]+"${arr[@]}"}`.

## Steps

- [01 — Writer: key routing and reading](standalone/01-writer-routing-and-reading.md)
- [02 — Writer: batch validation, atomic apply and reporting](standalone/02-writer-validate-apply-report.md)
- [03 — `kerghan configure` command](standalone/03-configure-command.md)
- [04 — bats tests](standalone/04-bats-tests.md)

## CI Checks
- `standalone/`: `docker-compose run --rm standalone_tests` (CI job: `standalone_tests`, runs
  `bats standalone/test` on `bats/bats:1.11.0`).

## Notes
- **Writer interface for #405.** The writer must be callable without `cmd_configure`. Per the
  issue it exposes, as separate functions (names left to the implementer): read a key's
  effective value and source; validate a batch of changes and report every problem without
  writing; apply a validated batch atomically per file; print the change list, apply hint and
  cross-key warnings for a batch; one `is_tty` helper.
- **Batch representation in bash 3.2.** Without associative arrays, hold a batch as parallel
  indexed arrays (e.g. keys, actions `set`/`unset`, values) in globals the writer functions
  share, in argument order (the change list follows argument order).
- **`set -e` pitfalls.** Validators return non-zero by design; call them only in `if` / `||`
  contexts, and capture command-substitution failures explicitly, as `default_env_lines` does.
- **`load_config` exits on invalid lines.** The listing and the "setting the invalid key fixes
  it" case need a non-exiting parse of `config`. Write a separate reader that records each
  key's lines, values and validity instead of changing `load_config` (which stays untouched).
- **CI runs as root.** The `bats/bats` image runs tests as root, so a read-only directory does
  not make a write fail there. Simulate the failed write another way (see step 04).
