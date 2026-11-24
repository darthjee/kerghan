# Issue: Tune the CI MySQL container for the DB tests job

## Description
Part of #582. The `DB tests` step of the `backend_db_tests` CircleCI job is slow. #583 (merged in PR #587) removed the per-test `TRUNCATE` cost. This issue tunes the throwaway MySQL service container that the job runs against.

## Problem
The `mysql:8.4.11` secondary container of `backend_db_tests` (`.circleci/config.yml`) has no `command:`, so it runs with the default durability settings: `innodb_flush_log_at_trx_commit=1`, the binary log on, the doublewrite buffer on, and `performance_schema` on. Every commit in the DB test tier pays for an fsync and binlog write that a throwaway database does not need. Locally the test DB runs on tmpfs, so this cost never showed up in the measurements for #582 and is untested.

## Expected Behavior
- The CI MySQL container starts with flags that trade crash durability for speed. This is acceptable because the database is discarded after every job.
- The median `DB tests` step time drops measurably compared with post-#583 `main`. The flags stay only if it does.
- Nothing outside the CI throwaway container changes.

## Solution
### Change
Add a `command:` to the `mysql:8.4.11` secondary image of `backend_db_tests` in `.circleci/config.yml`. List `mysqld` explicitly as the first element, followed by these flags:

```
mysqld
--innodb-flush-log-at-trx-commit=2
--skip-log-bin
--innodb-doublewrite=OFF
--performance-schema=OFF
```

`--innodb-flush-method=O_DIRECT_NO_FSYNC` is deliberately left out: `O_DIRECT` on the overlay filesystem of CircleCI containers is a boot and compatibility risk for little extra gain.

Put a comment next to the flags that states:
- durability is off on purpose, because the DB is throwaway;
- the flags were validated against `mysql:8.4.11`, so any tag bump must re-check them;
- with `--skip-log-bin`, CI does not exercise binlog-enabled behavior. A future migration that creates a trigger, function or procedure, which needs SUPER or `log_bin_trust_function_creators=1` when the binlog is on, must be checked against a binlog-enabled server.

### Scope
- **In scope:** the `backend_db_tests` secondary MySQL container only, and the timings recorded in the PR.
- **Out of scope:**
  - the local `kerghan_mysql_test` container, which is already on tmpfs;
  - the dev `kerghan_mysql` container, which is persistent;
  - production and the Render configuration;
  - test code and Jest config (#583 is done, #585 covers per-worker schemas);
  - other CI jobs;
  - the yarn cache (#586).

### Edge cases
- **Boot failure:** `mysqld` aborts on an unknown option, and the tier's `migrate-test-database.ts` would only report a connection timeout after 60 s (`READY_TIMEOUT_MS`). Before pushing, boot `docker run mysql:8.4.11 mysqld <flags>` locally once (with the same `MYSQL_*` env) and confirm it accepts connections. This is a one-off check, not a compose change.
- **Entrypoint:** CircleCI `command:` replaces the image CMD and keeps `docker-entrypoint.sh`. The temporary init server gets the same flags, which is harmless.
- **Start-up time:** note the time to the first successful connection as well as the step duration.

### Backward compatibility
The durability flags change crash safety only, not query results. Nothing in `backend/src` reads `performance_schema` or server variables, and the tier uses `information_schema`. The binlog gap above is accepted and documented in the comment. Today no migration creates a trigger, function or procedure.

### Measurement
- **Before:** the `DB tests` step duration from 3 recent `main` runs after #583.
- **After:** 3 runs of the PR branch (re-run the job).
- Keep the flags if the median drops by about 10% or more. Record all six numbers, and the start-up observation, in the PR. If the gain is below the threshold, report that and drop the change.

### Sequencing
Independent of #585: different files, and this issue ships first. #585's PR records its own timings with these flags in place, and #584 is not reopened.

## Benefits
- A faster `DB tests` step at the cost of a few lines of CI config, with no code change.
- The expected gain grows once #585 runs workers concurrently against MySQL.
