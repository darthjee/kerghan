# Standalone Plan: Client: `kerghan completion bash`

Main plan: [plan.md](plan.md)

## Shared contracts

- All client completion tests live in `standalone/test/completion*.bats` (`completion.bats`, `completion_command.bats`, `completion_safety.bats`, `completion_sync.bats`). The helper is `standalone/test/helpers/completion.bash`.
- The bash 3.2 run sets `KERGHAN_TEST_BASH32=1`. The `bash 3.2 guard` test in `completion_safety.bats` is skipped unless that variable is set.
- The 3.2 environment has bash 3.2.57, bats-core 1.11.0 and the BusyBox tools (`find`, `stat`, `mktemp`, `diff`, `grep`, `sed`, `env`). Tell infra if a test needs more.
- Infra provides `docker-compose run --rm bats_bash32` and the CircleCI job `standalone_completion_bash32`.

## Steps

- [01 — `completion` command and `usage` line](standalone/01-completion-command.md)
- [02 — The `_kerghan` completion function](standalone/02-completion-function.md)
- [03 — Test helper and `completion.bats`](standalone/03-helper-and-matrix-tests.md)
- [04 — `completion_command.bats` and existing usage tests](standalone/04-command-tests.md)
- [05 — `completion_safety.bats` and `completion_sync.bats`](standalone/05-safety-and-sync-tests.md)

## CI Checks

- `standalone/`:
  - `docker-compose run --rm standalone_tests` (CI job: `standalone_tests`, bash 5, full suite);
  - `docker-compose run --rm bats_bash32` (CI job: `standalone_completion_bash32`, bash 3.2, `completion*.bats`).

## Notes

- **Wait for #434.** Read the four value constants, the `FRONTEND_BASE_URL` constant and the `BASH_SOURCE` guard comment in the client as #434 merged them, and use those names.
- **Specs are the source of truth.** Copy every message, the `usage` line, the `complete` line and every `COMPREPLY` from the spec files verbatim. If the code and a spec disagree, the spec wins. If a spec is wrong or impossible, stop and report it; don't edit the spec folder in this PR.
- **Coverage is checked by name.** Every per-position table `Label`, every numbered edge case and every `contract <name>` has a test whose name starts with `matrix <label>:`, `edge <n>:` or `contract <name>:`. Before finishing, check each label and edge number with `grep`.
- **Out of scope:**
  - `standalone/install.sh` and `install_completion.bats` (#430);
  - `docs/agents/standalone.md` and the other permanent docs (#431);
  - zsh and fish.
