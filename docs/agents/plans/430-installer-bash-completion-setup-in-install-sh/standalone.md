# Standalone Plan: Installer: bash completion setup in `install.sh`

Main plan: [plan.md](plan.md)

## Overview

All the work is in `standalone/`, plus one spec file. The specs are `docs/agents/specs/auto-complete/install.md`, `contracts.md` and `security.md`; they win over this plan, except for the two deliberate updates to install.md listed in step 04.

## Context

- `kerghan completion bash` (#429) and the word-list constants (#434) are merged.
- `install.sh` runs `check_os`, `check_docker`, `check_dir`, staging plus `trap cleanup EXIT`, `fetch_client`, `ensure_vault`, `move_client`, the `installed to` info line, then `check_path`.
- The installer tests (`install.bats`, `helpers/install_setup.bash`) run `install.sh` with `PATH` limited to a stub dir (curl, docker, uname, optional vault) and a tools dir. The tools dir holds symlinks to `bash env cat chmod mkdir mktemp mv rm`.
- The curl stub serves a fake client that prints `fake kerghan <v>` for any arguments.
- The bats container runs as root, so chmod-based failures don't fail.

## Steps

- [01 — Completion step in install.sh](standalone/01-install-step.md)
- [02 — install.sh header](standalone/02-header.md)
- [03 — Test harness: stub client, mv wrapper, env isolation](standalone/03-test-harness.md)
- [04 — install_completion.bats and spec updates](standalone/04-tests-and-spec.md)

## CI Checks

- `standalone`: `docker-compose run --rm standalone_tests` (CI job: `standalone_tests`). It runs the whole `standalone/test` folder on bash 5, including the new `install_completion.bats` and the unchanged `install.bats`.
- `docker-compose run --rm bats_bash32` (CI job: `standalone_completion_bash32`) must stay green. Its glob `completion*.bats` does not match `install_completion.bats`, so nothing new runs there.
- Shellcheck, if the repo lints shell files in CI: keep `install.sh`, the stubs and the helper clean.

## Notes

- Never run `bats`, `bash` tests or any runtime on the host: only through `docker-compose`.
- `install.sh` must stay bash 3.2 compatible and self-contained. Use no arrays-of-arrays, no `${var,,}`, no `mapfile`; a plain `for p in $list` over the space-separated detection list is fine. Running it under bash 3.2 in CI is #433.
- `mktemp` creates the temp file `0600`. After `mv -f` the file keeps those permissions: readable by the user, not executable. That satisfies "not executable"; don't `chmod +x`.
- `update.bats` uses the curl stub's fake installer, not the real `install.sh`, so it is unaffected.
