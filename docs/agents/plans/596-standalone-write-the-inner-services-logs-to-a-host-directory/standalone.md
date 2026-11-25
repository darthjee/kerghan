# Standalone Plan: Standalone: write the inner services' logs to a host directory

Main plan: [plan.md](plan.md)

## Shared contracts

- **You produce:**
  - `LOGS_IMAGE=docker:<X.Y.Z>-cli` in `/vault/.env`, written by the Dockerfile's `.env` step. Pick
    the current stable patch. `infra` copies the exact string into
    `bin/release_kerghan_standalone.sh`.
  - The env variables `KERGHAN_FILE_LOGS`, `KERGHAN_HOST_UID` and `KERGHAN_HOST_GID`, passed with
    `-e` on every `vault up`.
  - The `-v <log-dir>:/vault/logs` mount, only when file logs are effectively on.
- **You rely on:** `infra` saving `standalone/images/<arch>/docker-cli.tar` for the offline variant.

## Steps

- [01 — Inner stack: `logs` collector service and bounded Docker logs](standalone/01-inner-stack-logs-service.md)
- [02 — Client: `file-logs` and `log-dir` config keys](standalone/02-client-config-keys.md)
- [03 — Client: wire the log directory into `kerghan up`](standalone/03-client-up-wiring.md)
- [04 — bats tests](standalone/04-bats-tests.md)
- [05 — Smoke test](standalone/05-smoke-test.md)
- [06 — Docs, README and `config.example`](standalone/06-docs.md)

## CI Checks

- `standalone/`: `docker-compose run --rm standalone_tests` (CI job: `standalone_tests`)
- `standalone/`: `docker-compose run --rm standalone_tests_bash32` (CI job:
  `standalone_tests_bash32`). The client must stay bash 3.2 compatible.
- Smoke test: `make standalone-smoke` locally. In CI it only runs in the `release-kerghan-standalone`
  tag job.

## Notes

- Never run bats, docker or any runtime on the host directly. Always go through `docker-compose`
  (see CLAUDE.md).
- Request a `security` agent review once the changes are in. It should cover the inner Docker
  socket on the `logs` service, file permissions and ownership, and the `log-dir` value flowing into
  `-v`.
- #606 (the Tent access-log format) is separate. Do not touch the Tent configuration here.
- The outer Vault container's own log stays unbounded (darthjee/vault#81). Only document it.
