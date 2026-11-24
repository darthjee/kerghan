# Plan: Per-worker test schemas and drop --runInBand in the DB tier

Issue: [585-per-worker-test-schemas-and-drop-runinband-in-the-db-tier.md](../../issues/585-per-worker-test-schemas-and-drop-runinband-in-the-db-tier.md)

## Overview
The DB-backed Jest tier (`yarn test:db`) currently runs every file serially against one schema. This plan gives each Jest worker its own `<prefix>_w<id>_test` schema. `globalSetup` creates the schemas and a narrow grant through an admin connection, then migrates all of them in parallel. A `setupFiles` hook points each worker at its schema by overriding `KERGHAN_MYSQL_NAME`. `--runInBand` is replaced by a fixed `maxWorkers`, and CI is measured on the medium and `large` resource classes.

## Agents involved

- [backend](backend.md): Jest config, the DB-tier harness (`backend/src/database/tests/db-tier/*`), unit and canary specs, parallel-safety fixes, and the backend testing docs.
- [infra](infra.md): compose `kerghan_db_tests`, the CircleCI `backend_db_tests` job, the resource-class measurement, and the CI docs.

## Shared contracts

- **Env vars read by the DB tier** (only by `globalSetup`, never by the app):
  - `KERGHAN_MYSQL_ADMIN_USER`: string, an admin able to `CREATE DATABASE` and `GRANT`. Value `root` in compose and CI.
  - `KERGHAN_MYSQL_ADMIN_PASSWORD`: string. Value `kerghan` in compose and CI (the containers' `MYSQL_ROOT_PASSWORD`).
  - If either is missing, `globalSetup` throws an error that names both.
- **Unchanged env vars:** `KERGHAN_MYSQL_HOST`, `KERGHAN_MYSQL_PORT`, `KERGHAN_MYSQL_USER` (`kerghan`), `KERGHAN_MYSQL_PASSWORD` (`kerghan`), `KERGHAN_MYSQL_NAME` (`kerghan_test`). In the DB tier, `KERGHAN_MYSQL_NAME` is now the **base** name the worker schemas are derived from.
- **Worker schema name:** `<base without trailing _test>_w<JEST_WORKER_ID>_test`. For example `kerghan_test` gives `kerghan_w1_test`, `kerghan_w2_test`, and so on.
- **Grant:** ``GRANT ALL ON `kerghan\_w%\_test`.* TO '<KERGHAN_MYSQL_USER>'@'%'``, with `_` and `%` in the prefix escaped. The `kerghan` user already exists in both MySQL containers (created by the image from `MYSQL_USER`). The containers' `MYSQL_DATABASE: kerghan_test` stays as it is; it is just no longer used by the workers.
- **Worker count:** `jest.db.config.ts` sets `maxWorkers: 2` as the default. CI overrides it with `npm run test:db -- --maxWorkers=<n>`: `2` on medium, `3` or `4` on `large`. The command itself (`npm run test:db` / `yarn test:db`) does not change.
- **Order of work:** backend's harness change and infra's env vars must land in the same PR. Without the admin vars, the new `globalSetup` fails fast.
