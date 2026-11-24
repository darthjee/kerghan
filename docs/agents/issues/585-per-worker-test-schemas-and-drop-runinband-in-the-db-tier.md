# Issue: Per-worker test schemas and drop --runInBand in the DB tier

## Description
Part of #582.

### Scope
- **Environments:** CI and the local compose `kerghan_db_tests` service share one code path. The per-worker schemas, their grants and the parallel run apply to both, with no CI-only branch.
- **CI resource class:** `backend_db_tests` sets no `resource_class`, so it runs on the Docker medium default (2 vCPU), which it shares with the MySQL secondary container.
  - In scope as a measured option. Run on medium with about 2 workers first, then try `large` (4 vCPU).
  - Keep `large` only if the measured gain justifies the extra credits; otherwise stay on medium.

#### In scope
- One schema per Jest worker, in CI and in the compose `kerghan_db_tests` service, through the same code path.
- Pointing each worker at its schema through a single per-worker override of `KERGHAN_MYSQL_NAME`. Every harness, `buildDbTierOptions` and `AppModule` already read that variable, so none of them needs its own change.
- Creating each worker schema, granting access to it, and migrating it.
- Dropping `--runInBand` and setting `maxWorkers`.
- Measuring the run on medium, then on `large` (see above).
- Fixing any spec that breaks only because files now run in parallel. Those fixes stay minimal (see *Specs that break in parallel* below).

#### Out of scope
- The per-test cleanup strategy. DELETE vs. TRUNCATE was settled in #583.
- MySQL server tuning flags, settled in #584.
- The unit tier (`jest.config.ts`) and the e2e tier. Neither changes.
- Making per-file setup itself cheaper (Nest module compile, SWC cache, sharing the `DataSource`).
- The dev database and the production configuration.
- **Deferred follow-up:** CircleCI `parallelism` (splitting DB-tier files across several containers). Reconsider it once this issue's per-worker numbers exist.

#### Specs that break in parallel
- Workers share no state in the database: each one has its own schema, and nothing uses MySQL's server-wide state (`GET_LOCK`, `SET GLOBAL`). The locking is row-level `SELECT … FOR UPDATE`, which stays inside a schema. Any breakage is therefore expected to come from timing or in-process assumptions.
- The main risk is CPU contention in the race and concurrency specs (`src/issues/tests/races/*`, `src/repositories/tests/races/*`, `*.concurrency.db-spec.ts`, `issues-sync.race`, `repositories.routes.add-race`). With 2–4 workers sharing CPUs with MySQL, they may get slower or interleave differently.
- **Default: fix in this issue.** Make the spec deterministic, for example by awaiting explicit barriers instead of relying on timing. Never fix it by only raising timeouts.
- **Fallback:** if a spec can't reasonably be made parallel-safe, move it to a second Jest project that runs serially (`maxWorkers: 1`) and open a follow-up issue naming that spec. The PR must list every such exception.

## Problem
`test:db` runs with `--runInBand` (`backend/package.json`) because all 79 files share one schema and truncate it before each test. About half of the suite time (~57 s locally, ~0.7 s per file) is per-file set-up (Nest module compile, SWC transform, `DataSource` init), which can never overlap while files run serially.

## Expected Behavior
- All DB-tier specs pass in parallel, repeatedly: the local and CI run counts in *Testing strategy*, with no flake.
- The isolation canary passes on every worker.
- Before/after durations of the `DB tests` step in CI are recorded in the PR description, and the resource class choice is justified from them.
- Every spec moved to the serial fallback (if any) is listed in the PR and has a follow-up issue.

## Solution

### Work
- Give each Jest worker its own schema, `<prefix>_w<JEST_WORKER_ID>_test` (e.g. `kerghan_w1_test`, so `assertTestDatabase` keeps passing), selected by a per-worker `KERGHAN_MYSQL_NAME` override in `setupFiles` (see *Edge cases* and *Backward compatibility*).
- In `globalSetup`, create the schemas and a narrow grant through an admin connection (see *Schema creation & grants*), then migrate every schema in parallel (see *Migration strategy*).
- Drop `--runInBand` and set a fixed `maxWorkers` (see *Performance & security*).
- Check the race specs (`*.race.db-spec.ts`, `*.concurrency.*`) still behave: they rely on timing within one file, not across files.

### Schema creation & grants
`globalSetup` creates the schemas and the grant through an admin connection.
- New env vars, read only by the DB tier: `KERGHAN_MYSQL_ADMIN_USER` and `KERGHAN_MYSQL_ADMIN_PASSWORD`. Set them to root / `kerghan` in both compose `kerghan_db_tests` and the CI `backend_db_tests` job.
- `globalSetup` opens one admin connection and runs `CREATE DATABASE IF NOT EXISTS` for each worker schema. It then runs one idempotent ``GRANT ALL ON `<prefix>\_w%\_test`.* TO '<KERGHAN_MYSQL_USER>'@'%'``, where the prefix is derived from the base name with any `_`/`%` in it escaped. Then it closes the admin connection.
- Migrations and every test run as `KERGHAN_MYSQL_USER`, never as the admin. That also proves on every run that the narrow grant is enough.
- Admin credentials never reach the workers. Only `globalSetup` reads them, and they aren't passed into the `setupFiles` override.
- If the admin vars are missing, fail with a clear error naming them.

Rejected:
- **The tests connect as root:** it throws away the narrow grant.
- **An init SQL script in the container (`docker-entrypoint-initdb.d`):** a CircleCI secondary container can't mount files, so CI would need a custom image or a different path, which breaks the single code path. A container that's already running would also need to be recreated.

### Migration strategy
Migrate every worker schema in `globalSetup`, in parallel.
- Wait for MySQL once, as today. Load the migration classes once (`loadMigrations`) and share them between the N `DataSource`s.
- With `Promise.all` over schemas `1..maxWorkers`, one `DataSource` each: make sure the schema exists (see *Schema creation & grants*), run the pending migrations, then destroy the `DataSource`.
- **Fail fast:** if any schema's migration fails, `globalSetup` fails the whole run with the schema name in the error.
- Log the duration of each schema's migration and the total.
- Migrations running at the same time in different schemas don't conflict: each schema has its own `migrations` table, and MySQL's metadata locks apply per table.

Rejected:
- **Serial migration in `globalSetup`:** the cost grows linearly with the worker count.
- **Migrating a template schema and cloning it:** `CREATE TABLE … LIKE` doesn't copy foreign keys, and MySQL has no `CREATE DATABASE … TEMPLATE`.
- **Lazy migration in each worker:** `setupFiles` gets a fresh module registry for every file, so "already migrated" would have to be checked against the database before every file. That adds back the per-file cost this issue is trying to cut.

### Edge cases
- **Naming vs. the `_test` guard:** `kerghan_test_<id>` would fail `assertTestDatabase`. Derive each worker's name from the base instead: check the base `KERGHAN_MYSQL_NAME` with the guard, strip `_test`, then append `_w<id>_test` (`kerghan_test` → `kerghan_w1_test`). Run the guard on the derived name too. The base schema itself is no longer used by any worker.
- **How many schemas:** `globalSetup` receives Jest's `globalConfig`. Create and migrate schemas `1..globalConfig.maxWorkers`, whatever sets that number (config, CLI `--maxWorkers`, or Jest's default). Extra schemas, when Jest runs fewer workers (a single file, a `-t` filter), are harmless. In-band runs use `JEST_WORKER_ID=1`, so running one file locally still works.
- **Missing worker id or schema:** if `JEST_WORKER_ID` is unset or larger than `maxWorkers`, fail with a clear error. Never fall back silently to the base schema.
- **Leftover or stale schemas:** keep today's behavior. Migrate only pending migrations, and let `truncate-each` clear the data. Schema drift after switching branches with edited migrations already exists today and stays out of scope. Schemas left over from an earlier run with more workers are left alone.
- **Connection ceiling:** each file can open about 25 connections (tier `DataSource` pool of 5, `openEntityDataSource` pool of 10, the Nest app's pool). 4 workers come to about 100, against MySQL's default `max_connections` of 151. No change now. If `large` with 4+ workers hits "Too many connections", lower the tier pool sizes or raise `max_connections` on the test containers.
- **Workers recycled mid-run:** Jest gives a replacement worker an id in the same `1..N` range, so it reuses that schema. No action needed.

### Backward compatibility
- **What `KERGHAN_MYSQL_NAME` means:** in the DB tier it becomes the base name the worker schemas are derived from, no longer the schema the tests use. The app and production read it as before; the per-worker override only exists in the tier's Jest `setupFiles`. Document the new meaning in `jest.db.config.ts`, `docs/agents/architecture/backend/testing.md` and `docs/agents/architecture/infra/ci-jobs.md`, and check `docs/agents/modules/{issues,repositories}/testing.md`.
- **When the override applies:** `src/database/data-source.ts` reads `process.env` when it's imported, and `AppModule` reads it through ConfigService. Set the override in a `setupFiles` entry (it runs before the test framework and before any of the spec's imports), not in `setupFilesAfterEnv`. No spec or harness hardcodes `kerghan_test`.
- **Developer workflows:** running one file with `yarn test:db <path>` or an explicit `--runInBand` still works, using worker 1 and `kerghan_w1_test`. The command (`npm run test:db`) is unchanged in CI and in compose.
- **Local containers that are already running:** the grant is applied on every run by `globalSetup` (see *Schema creation & grants*), so a `kerghan_mysql_test` that's already up keeps working without being recreated. The only local change is adding the admin env vars to compose `kerghan_db_tests`.
- **Existing unit specs:** `db-tier-options.spec.ts` gains cases for deriving the worker name. Its existing assertions keep passing.

### Performance & security
- **Fixed worker count:** inside a CircleCI Docker container, `os.cpus()` (which Jest's default uses) reports the host's cores, not the resource class's vCPU. Set `maxWorkers` to a fixed number in `jest.db.config.ts` (default `2`), and have CI pass `--maxWorkers=<n>` to match its resource class (2 on medium, about 3–4 on `large`). Never a percentage.
- **MySQL shares the same CPUs:** on the Docker executor the MySQL secondary container draws on the same resource-class allowance, so the gain on medium may be small. That is why medium vs. `large` is measured, not assumed.
- **globalSetup cost:** migrating N schemas instead of one adds setup time. Log globalSetup's duration on its own in the measured runs.
- **Narrow grant:** never grant the `kerghan` user `ALL ON *.*`. Grant only on the worker-schema pattern, for example ``GRANT ALL ON `kerghan\_w%\_test`.* TO 'kerghan'@'%'`` (`_` is a wildcard in GRANT patterns, so escape it). MySQL then refuses any schema that isn't a test schema, which backs up the `_test` guard in code.
- **Exposure doesn't change:** the test databases are throwaway, hold no real data, and the compose service publishes no port.

### Testing strategy
- **Unit specs (`yarn test`):** deriving the worker name (`kerghan_test` + worker 1 → `kerghan_w1_test`), the guard rejecting a bad base name, a missing or out-of-range `JEST_WORKER_ID` throwing, and the list of schemas to create for a given `maxWorkers`.
- **Isolation canary (DB tier):** a small `*.db-spec.ts` asserting that `SELECT DATABASE()` equals the schema expected for the current `JEST_WORKER_ID`, both through the tier `DataSource` and through a Nest app harness.
- **No flakiness:**
  - Locally (compose): 5 runs of the full `test:db` in a row at the CI worker count, plus 2 runs at a higher count (for example `--maxWorkers=4`).
  - CI: `backend_db_tests` passes on 3 runs of the PR (the first run plus 2 reruns), for each resource class tried.
  - Any failure that passes on rerun counts as a flake. It is fixed, or it goes through the serial fallback with a follow-up issue; it is never ignored.
- **Race specs:** no special job. They must pass in the full parallel runs above.
- **Timing evidence (PR description):** "before" is the `DB tests` step duration from the last 3 runs on `main`. "After" is the same step on medium (about 2 workers) and on `large` (about 4 workers), with each run's duration. The resource class decision follows from these numbers.

### Not measured yet
No number exists for the parallel run; measure it as part of this issue.

## Benefits
- Per-file set-up (about half of the DB-tier time) overlaps across workers instead of running serially, shortening the `DB tests` CI step.
- Worker isolation is enforced both in code (the `_test` guard) and by MySQL (the narrow grant).
