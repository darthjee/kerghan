# Admin schema creation and grant in globalSetup

In `migrate-test-database.ts`, add a `prepareWorkerSchemas(env, maxWorkers)` phase that runs before any migration:

1. Read `KERGHAN_MYSQL_ADMIN_USER` / `KERGHAN_MYSQL_ADMIN_PASSWORD`. If either is missing, throw an error naming both variables.
2. Open one admin `DataSource` (same host and port, admin credentials, **no `database`**), reusing the existing `initializeWithRetry`, so the MySQL wait happens here, once.
3. For each name from `workerSchemaNames(base, maxWorkers)`: run ``CREATE DATABASE IF NOT EXISTS `<name>` ``. Names come only from the asserted helpers, never from raw input; still, quote them with backticks.
4. Run the idempotent ``GRANT ALL ON `<workerGrantPattern(base)>`.* TO ?@'%'``, with `KERGHAN_MYSQL_USER` passed as a parameter if the driver allows it there, otherwise validated against `^[A-Za-z0-9_]+$` and quoted.
5. Destroy the admin `DataSource` in a `finally` block.

Change `global-setup.ts` to accept Jest's `globalConfig` (`globalSetup(globalConfig: { maxWorkers: number })`) and pass `globalConfig.maxWorkers` through to `migrateTestDatabase`.

## Files to Change
- `backend/src/database/tests/db-tier/migrate-test-database.ts`: add the admin phase; `migrateTestDatabase` takes `maxWorkers`.
- `backend/src/database/tests/db-tier/global-setup.ts`: take `globalConfig` and pass `maxWorkers` on; update the JSDoc.
- `backend/src/database/tests/db-tier/db-tier-options.ts`: an admin-options builder, if that's cleaner than building the admin options inline.
