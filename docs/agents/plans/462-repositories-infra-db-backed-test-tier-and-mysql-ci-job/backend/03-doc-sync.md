# Spec and architecture doc sync

Bring the specs and the backend architecture doc in line with what was built.

- **`docs/agents/specs/repos/testing.md#db-backed-tier`:**
  - "real MySQL 8" becomes `mysql:8.4.11` (production's version);
  - "the Repositories tables are truncated before each test" becomes "every table except `migrations` is truncated before each test";
  - "against the existing MySQL service" becomes the throwaway `kerghan_mysql_test` service, run through `kerghan_db_tests`;
  - the CI bullet names `backend_db_tests` with a `mysql:8.4.11` service container, not `cimg/mysql:8.0`;
  - the "Who adds it … None of it exists yet" bullet says #462 added it;
  - the `_test` guard and the source-loaded migrations are mentioned.
- **`docs/agents/architecture/backend.md#testing`:** replace "No live database in CI yet …" and the closing "Add a `cimg/mysql` service …" paragraph with a short **DB-backed tier** subsection: the suffix, `yarn test:db`, serial, the `_test` schema guard, truncate-all, and when to use it (only SQL semantics the fakes cannot prove). The issue allows this exception to the "no permanent docs" rule.

## Files to Change
- `docs/agents/specs/repos/testing.md`: DB-tier section updated.
- `docs/agents/architecture/backend.md`: Testing section updated.
