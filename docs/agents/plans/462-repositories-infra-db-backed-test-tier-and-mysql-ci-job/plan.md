# Plan: Repositories: Infra — DB-backed test tier and MySQL CI job

Issue: [462-repositories-infra-db-backed-test-tier-and-mysql-ci-job.md](../../issues/462-repositories-infra-db-backed-test-tier-and-mysql-ci-job.md)

## Overview

This plan adds the DB-backed test tier (`*.db-spec.ts`, `yarn test:db`), which runs serially against a real MySQL. Each run applies the migrations from the TypeScript sources once and truncates every table except `migrations` before each test. A smoke spec proves the tier works.

The infra agent wires a throwaway `kerghan_mysql_test` compose service and a `backend_db_tests` CircleCI job with a MySQL service container, and makes the release and deploy jobs require it. Dev, test and CI all move to `mysql:8.4.11`, the version production runs. Standalone stays on 9.3.0 and moves in #469.

## Agents involved

- [backend](backend.md)
- [infra](infra.md)

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
