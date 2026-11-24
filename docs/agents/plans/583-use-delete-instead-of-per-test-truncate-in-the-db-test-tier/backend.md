# Backend Plan: Use DELETE instead of per-test TRUNCATE in the DB test tier

Main plan: [plan.md](plan.md)

## Overview
`truncateAll` (`backend/src/database/tests/db-tier/db-tier.ts`) runs before each of ~993 tests: one `information_schema` query, then one `TRUNCATE TABLE` (DDL in MySQL 8) per table, around `FOREIGN_KEY_CHECKS` toggles. Measured: 36 ms per call versus 3 ms with `DELETE FROM`; full suite 115.6 s to 91.8 s locally with all tests passing.

## Context
- `truncateAll` is called only from `truncate-each.ts` (`beforeEach`); `onTruncated` re-seed hooks run right after it and are unchanged.
- The `migrations` table must keep being excluded (emptying it makes migrations re-run on the next start).
- Auto-increment is no longer reset by `DELETE`; a full run already passed with IDs climbing across tests, so no spec depends on a reset.
- The table set cannot change mid-file: migrations only run in `globalSetup`.

## Implementation Steps

### Step 1 — Switch to `DELETE FROM` and cache the table list
In `db-tier.ts`:
- Replace ``TRUNCATE TABLE `<name>` `` with ``DELETE FROM `<name>` `` (foreign-key checks still disabled on the same query runner, re-enabled in `finally`).
- Cache the table list in module scope, loaded on first use and cleared in `destroyTestDataSource` (so each test file, which loads its own module registry, queries `information_schema` once).
- Keep the `migrations` exclusion; update the doc comment (it is no longer a truncate, and says why `DELETE` is used).
- Consider renaming `truncateAll`/`truncate-each.ts` only if cheap; otherwise keep the names so `onTruncated`/`runTruncatedHooks` callers are untouched.

### Step 2 — Verify and update docs
- Run `docker-compose run --rm --no-deps kerghan_db_tests yarn test:db` three times in a row; all 79 suites must pass each time. Record the duration against the 115.6 s baseline.
- Check `database/tests/db-tier.db-spec.ts` ("truncation between tests") still expresses the contract (every table but `migrations` is empty at the start of each test).
- Update the wording in `docs/agents/architecture/backend/testing.md` (line ~48) and `docs/agents/modules/repositories/testing.md` (line ~31), which say tables are truncated, to say they are emptied with `DELETE`.

## Files to Change
- `backend/src/database/tests/db-tier/db-tier.ts` — `DELETE FROM` instead of `TRUNCATE TABLE`, cached table list, doc comment.
- `backend/src/database/tests/db-tier/truncate-each.ts` — comment wording only, if needed.
- `docs/agents/architecture/backend/testing.md` — "truncated" wording.
- `docs/agents/modules/repositories/testing.md` — "truncated" wording.

## CI Checks
- `backend`: `yarn test:db` (CI job: `backend_db_tests`), `yarn lint` (CI job: `backend_checks`), `yarn coverage` (CI job: `backend_tests`)

## Notes
- Local timings are on tmpfs MySQL; record the CI `DB tests` step before and after (the issue's acceptance).
- Running `yarn` locally needs docker-compose (`kerghan_db_tests` service, `--no-deps` since `kerghan_mysql` collides on port 3306 on some hosts; start `kerghan_mysql_test` first).
