# Backend Plan: Repositories: Infra — DB-backed test tier and MySQL CI job

Main plan: [plan.md](plan.md)

## Shared contracts

- **MySQL image:** `mysql:8.4.11` (official image) for the local `kerghan_mysql`, the local `kerghan_mysql_test` and the CI service container. Standalone stays on `9.3.0` (#469).
- **Script:** `yarn test:db`, which runs `jest --config jest.db.config.ts --runInBand`, from `backend/`. It never runs with `--coverage`.
- **Connection env vars:** the tier reuses the app's existing variables, set to the test database by whoever runs it:

  | Var | Local (`kerghan_db_tests`) | CI (`backend_db_tests`) |
  |---|---|---|
  | `KERGHAN_MYSQL_HOST` | `mysql_test` (link alias of `kerghan_mysql_test`) | `127.0.0.1` |
  | `KERGHAN_MYSQL_PORT` | `3306` | `3306` |
  | `KERGHAN_MYSQL_USER` | `kerghan` | `kerghan` |
  | `KERGHAN_MYSQL_PASSWORD` | `kerghan` | `kerghan` |
  | `KERGHAN_MYSQL_NAME` | `kerghan_test` | `kerghan_test` |

- **The MySQL container** (local and CI) gets `MYSQL_DATABASE=kerghan_test`, `MYSQL_USER=kerghan`, `MYSQL_PASSWORD=kerghan`, `MYSQL_ROOT_PASSWORD=kerghan`, and no persistent volume.
- **Safety guard (backend):** the tier refuses to start unless `KERGHAN_MYSQL_NAME` ends in `_test`, so a misconfigured run can never truncate dev or production data.
- **Readiness (backend):** the tier's Jest `globalSetup` retries the connection for up to 60 s, so neither compose nor CI needs a separate wait step.
- **Names:**
  - compose service `kerghan_mysql_test`;
  - compose runner `kerghan_db_tests`;
  - Make target `db-tests`;
  - CircleCI job `backend_db_tests`.

## Steps

- [01 — Jest DB config, script and tier helpers](backend/01-jest-db-config-and-helpers.md)
- [02 — Smoke db-spec, lint and default-run isolation](backend/02-smoke-db-spec.md)
- [03 — Spec and architecture doc sync](backend/03-doc-sync.md)

## CI Checks

- `backend`: `docker-compose run --rm kerghan_tests yarn coverage` (CI job: `backend_tests`): must stay green, with no `*.db-spec.ts` picked up.
- `backend`: `docker-compose run --rm kerghan_tests yarn lint` (CI job: `backend_checks`).
- `backend`: `docker-compose run --rm kerghan_db_tests` (CI job: `backend_db_tests`; needs infra's compose service).

## Notes

- **The default `testRegex` already skips db-specs.** `.*\\.(spec|e2e-spec)\\.ts$` does not match `x.db-spec.ts`, because `.db-spec` is neither `.spec` nor `.e2e-spec`. Keep it that way, and add `'!**/*.db-spec.ts'` to `collectCoverageFrom` so no db-spec counts as source.
- **Migrations load from source.** `data-source.ts` points at `dist/` and is untouched. The tier builds its own `DataSource`, with `migrations` set to `src/database/migrations/[0-9]*.ts` (absolute paths via `path.join(__dirname, …)`) so the swc transform compiles them. Entities are not needed: the smoke spec uses raw queries.
- **Never use the host.** Every yarn or jest command goes through docker-compose (CLAUDE.md).
