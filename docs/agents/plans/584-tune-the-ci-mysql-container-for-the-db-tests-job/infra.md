# Infra Plan: Tune the CI MySQL container for the DB tests job

Main plan: [plan.md](plan.md)

## Overview
Add a `command:` to the `mysql:8.4.11` secondary image of `backend_db_tests` so that MySQL skips the fsync, binlog, doublewrite and performance-schema work a throwaway database does not need. Validate the flags locally before pushing, update the CI jobs doc, and record the before and after timings in the PR.

## Context
- `.circleci/config.yml` (around lines 195–218): `backend_db_tests` runs `darthjee/circleci_kerghan-base:0.1.2` plus a `mysql:8.4.11` secondary image with only `MYSQL_*` environment and no `command:`.
- The tier's Jest `globalSetup` waits for MySQL through `backend/src/database/tests/db-tier/migrate-test-database.ts` (60 s `READY_TIMEOUT_MS`, 1 s retry). A flag that stops `mysqld` from booting therefore shows up only as a connection timeout.
- #583 (PR #587) has merged, so the "before" baseline is current `main`.
- Out of scope:
  - `docker-compose.yml` (neither `kerghan_mysql` nor `kerghan_mysql_test` changes);
  - production;
  - test code;
  - other jobs.

## Implementation Steps

### Step 1 — Add the flags, the comment and the doc note, validated locally
1. Validate the exact flag set locally first, without changing compose. Start a container with `docker run -d --rm --name kerghan_584_check -e MYSQL_DATABASE=kerghan_test -e MYSQL_USER=kerghan -e MYSQL_PASSWORD=kerghan -e MYSQL_ROOT_PASSWORD=kerghan mysql:8.4.11 mysqld --innodb-flush-log-at-trx-commit=2 --skip-log-bin --innodb-doublewrite=OFF --performance-schema=OFF`.
2. Wait until `docker exec kerghan_584_check mysqladmin ping -ukerghan -pkerghan` succeeds, then confirm the settings took effect: `SELECT @@innodb_flush_log_at_trx_commit, @@log_bin, @@innodb_doublewrite, @@performance_schema` should return `2, 0, OFF, 0`.
3. Note roughly how long the container took to accept connections, then stop the container.
4. In `.circleci/config.yml`, add to the `mysql:8.4.11` secondary image of `backend_db_tests`:

   ```yaml
   command:
     - mysqld
     - --innodb-flush-log-at-trx-commit=2
     - --skip-log-bin
     - --innodb-doublewrite=OFF
     - --performance-schema=OFF
   ```

   Precede it with a short comment saying three things:
   - durability is off on purpose, because the DB is throwaway and discarded after each job;
   - the flags were validated against `mysql:8.4.11`, so a tag bump must re-check them;
   - with `--skip-log-bin`, CI does not exercise binlog-enabled behavior, so a migration that adds a trigger, function or procedure (which needs SUPER or `log_bin_trust_function_creators=1` with the binlog on) must be checked against a binlog-enabled server.

   Do not add `--innodb-flush-method=O_DIRECT_NO_FSYNC`.
5. In `docs/agents/architecture/infra/ci-jobs.md`, update the "`backend_db_tests` — the DB-backed tier" section (around line 31). It should say that the secondary container starts with those flags, give the reason, and mention the binlog caveat. Keep it to a sentence or two.

### Step 2 — Measure on CI and record the result in the PR
1. Before: from CircleCI, take the `DB tests` step duration of the 3 most recent `backend_db_tests` runs on `main`, all after #587.
2. After: take the same step duration from 3 runs of the PR branch. Use the first run plus 2 re-runs of the job.
3. Put a small table in the PR description with all six numbers, both medians and the percentage change, plus the local start-up observation from Step 1.
4. If the median improves by about 10% or more, keep the change. Otherwise, revert the `command:`, the comment and the doc note, and report in the PR that the gain was not real. The PR then only records the measurement.

## Files to Change
- `.circleci/config.yml`: add `command:` with `mysqld` and the 4 flags to the `mysql:8.4.11` secondary image of `backend_db_tests`, with the explanatory comment.
- `docs/agents/architecture/infra/ci-jobs.md`: note the flags and the binlog caveat in the `backend_db_tests` section.

## CI Checks
- `.circleci/config.yml`: `circleci config validate` if the CLI is available (run through Docker, not on the host). Otherwise rely on the pipeline itself.
- `backend`: the `backend_db_tests` job (`npm run test:db`) must stay green on the PR branch.

## Notes
- Run everything through Docker. Never run `yarn`, `npm` or `node` on the host (CLAUDE.md boundary).
- CircleCI `command:` overrides the image CMD and keeps `docker-entrypoint.sh`. Listing `mysqld` explicitly avoids relying on the entrypoint's `-`-prefix detection.
- Step-level timings need CircleCI access (the UI or the API via `gh`/`curl`, if a token is available). If the numbers cannot be fetched automatically, leave a clearly marked placeholder table in the PR for the owner to fill in, rather than inventing numbers.
