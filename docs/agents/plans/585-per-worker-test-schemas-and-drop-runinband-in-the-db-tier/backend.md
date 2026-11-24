# Backend Plan: Per-worker test schemas and drop --runInBand in the DB tier

Main plan: [plan.md](plan.md)

## Shared contracts

- Read `KERGHAN_MYSQL_ADMIN_USER` / `KERGHAN_MYSQL_ADMIN_PASSWORD` **only in `globalSetup`**. Throw a clear error naming both when either is missing. Infra provides them in compose and CI.
- In the DB tier, `KERGHAN_MYSQL_NAME` is the base name. Worker schema: `<base without _test>_w<JEST_WORKER_ID>_test` (`kerghan_test` gives `kerghan_w1_test`).
- Grant: ``GRANT ALL ON `<escaped prefix>\_w%\_test`.* TO '<KERGHAN_MYSQL_USER>'@'%'``.
- `jest.db.config.ts`: `maxWorkers: 2` by default. CI may pass `--maxWorkers=<n>`; `globalSetup` must use the resolved `globalConfig.maxWorkers`, never its own constant.

## Steps

- [01 — Worker schema naming helpers](backend/01-worker-schema-naming.md)
- [02 — Admin schema creation and grant in globalSetup](backend/02-admin-create-and-grant.md)
- [03 — Parallel per-schema migrations](backend/03-parallel-migrations.md)
- [04 — Per-worker override in setupFiles and drop --runInBand](backend/04-setupfiles-override-and-workers.md)
- [05 — Isolation canary spec](backend/05-isolation-canary.md)
- [06 — Make the DB tier parallel-safe](backend/06-parallel-safety.md)
- [07 — Update the backend testing docs](backend/07-docs.md)

## CI Checks
- `backend`: `docker-compose run --rm kerghan_tests yarn test` (CI job: `backend_tests`)
- `backend`: `docker-compose run --rm kerghan_tests yarn lint` (CI job: `backend_checks`)
- `backend`: `docker-compose run --rm kerghan_db_tests` (CI job: `backend_db_tests`). Per the issue's testing strategy: 5 runs in a row at the default worker count, plus 2 runs with `yarn test:db --maxWorkers=4`.

## Notes
- **Jest workers inherit the container env, admin vars included.** The `setupFiles` hook must `delete process.env.KERGHAN_MYSQL_ADMIN_USER` and `KERGHAN_MYSQL_ADMIN_PASSWORD`, so the admin credentials never reach spec code (see the issue's *Schema creation & grants*).
- **Keep the override idempotent.** Derive the worker name from the base name, not from a value that may already have been overridden. Stash the base in `KERGHAN_MYSQL_BASE_NAME` the first time and reuse it. That way it doesn't matter whether Jest's per-file `process` copy leaks between files.
- Never fix a flaky race spec only by raising timeouts (see the issue's *Specs that break in parallel*).
- Each spec moved to the serial fallback gets a follow-up issue and is listed in the PR description.
