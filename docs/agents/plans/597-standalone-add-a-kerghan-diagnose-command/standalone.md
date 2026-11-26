# Standalone Plan: Standalone: add a kerghan diagnose command

Main plan: [plan.md](plan.md)

## Overview

A new `kerghan diagnose` subcommand in `standalone/bin/kerghan`. It is read-only, bash 3.2-safe,
and reuses the existing helpers (`port_listeners`, `running_image`, `running_port`,
`running_bind`, `running_auto_login`, `running_file_logs`, `running_log_dir`, `load_config`).
The issue file is the source of truth for every behavior: the probe/verdict table, edge cases
E1–E11, the output layout and the exit-code table.

## Context

- #594's sub-issues #595 (`port_listeners`, `warn_port_conflict`, the AirPlay hint) and #596
  (`file-logs`, `log-dir`, `running_log_dir`) are merged. #598 (the advertised URL) is still open.
  #594 is released only once all of them are done.
- The advertised URL is hard-coded today in two `echo` lines of `cmd_up`
  (`Kerghan is running at http://localhost:$port`, `... already running at ...`). Diagnose must
  read the same value, so step 01 moves it into one helper that #598 then changes in one place.
- The bash completion lists the commands by hand (`_kerghan_offer ... up down logs status ...` in
  `completion_bash_script`), and `completion_sync.bats` cross-checks the list against
  `kerghan help`.
- The bats suite runs on bash 5 (`standalone_tests`) and bash 3.2 (`standalone_tests_bash32`).

## Steps

- [01 — Shared helpers](standalone/01-shared-helpers.md)
- [02 — The diagnose command](standalone/02-diagnose-command.md)
- [03 — Help, dispatch, completion and the `up` hint](standalone/03-help-completion-up-hint.md)
- [04 — Tests](standalone/04-tests.md)
- [05 — Docs](standalone/05-docs.md)

## CI Checks

- `standalone/`: `docker-compose run --rm standalone_tests` (CI job: `standalone_tests`)
- `standalone/`: `docker-compose run --rm standalone_tests_bash32` (CI job:
  `standalone_tests_bash32`)
- Shellcheck / Codacy on `standalone/bin/kerghan` and the stubs, as in previous standalone PRs.

## Notes

- Never run `bats`, `bash` tooling or `curl` on the host: always use the compose services above.
- Diagnose must not call `ensure_env_file`, or any other helper that writes under `~/.kerghan`.
  `load_config` only reads, so it is safe.
- The "reachable at" hint uses `advertised_url`'s counterpart for the published address. When
  #598 lands, only `advertised_url` changes, and diagnose follows it automatically (if it then
  equals the published address, probe 2 is skipped).
- Server-side identity marker: out of scope, tracked in #609.
- No `smoke_test.sh` change (it drives the container directly, not through the client).
