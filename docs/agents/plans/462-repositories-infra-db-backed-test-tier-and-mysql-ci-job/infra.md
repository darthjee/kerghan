# Infra Plan: Repositories: Infra — DB-backed test tier and MySQL CI job

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

- [01 — docker-compose services and Make target](infra/01-compose-and-make.md)
- [02 — CircleCI backend_db_tests job](infra/02-circleci-job.md)
- [03 — Infra docs, dev reset note and epic README](infra/03-docs.md)

## CI Checks

- `.circleci/config.yml`: `circleci config validate` through docker (see `architecture/infra.md#validating-the-circleci-config-locally`).
- `backend`: `docker-compose run --rm kerghan_db_tests` (CI job: `backend_db_tests`).

## Notes

- **Dev data reset.** Moving `kerghan_mysql` from 9.3.0 to 8.4.11 means existing `docker_volumes/mysql_data` will not start, because MySQL cannot downgrade a data directory. Steps 03 and the PR description give the one-time reset. Changing the image needs a new release.
- **Standalone is out of scope.** Leave `standalone/`, `bin/release_kerghan_standalone.sh`, `docs/agents/standalone.md` and the standalone line in `infra.md#release-kerghan-standalone` on 9.3.0; #469 moves them.
- **The CI primary image is unchanged.** `darthjee/circleci_kerghan-base:0.1.0` runs the tests. MySQL is only a secondary container, reached on `127.0.0.1`.
