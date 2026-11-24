# Parallel per-schema migrations

After the admin phase, migrate every worker schema as `KERGHAN_MYSQL_USER` (never as the admin, so every run proves the narrow grant is enough):

- Call `loadMigrations()` once and share the classes.
- Run `Promise.all` over `workerSchemaNames(base, maxWorkers)`. For each schema: `new DataSource({ ...buildDbTierOptions(env, migrations), database: name })`, `initialize()` (MySQL is already up, so no retry is needed), `runMigrations({ transaction: 'each' })`, and `destroy()` in a `finally` block.
- **Fail fast:** wrap each schema's errors so the message includes the schema name. Any rejection fails `globalSetup`. Make sure the other `DataSource`s still get destroyed, using `Promise.allSettled` before rethrowing the first failure.
- Log each schema's migration time and the total `globalSetup` time with one `console.log` line each, so the CI measurement can separate setup cost from test time.

Keep today's behavior for existing schemas: only pending migrations run, and nothing is dropped.

## Files to Change
- `backend/src/database/tests/db-tier/migrate-test-database.ts`: parallel migration loop and timing logs.
