# Isolation canary spec

Add `backend/src/database/tests/worker-schema.db-spec.ts`, which asserts that each worker is really isolated:

- Through `getTestDataSource()`: `SELECT DATABASE() AS name` equals `workerSchemaName(process.env.KERGHAN_MYSQL_BASE_NAME, Number(process.env.JEST_WORKER_ID))`.
- Through a Nest app harness that builds its TypeORM connection from config (reuse the lightest existing `build-*-test-app.ts`, for example `auth/tests/support/build-auth-test-app.ts`): the app's `DataSource` reports the same schema.
- `process.env.KERGHAN_MYSQL_ADMIN_USER` and `KERGHAN_MYSQL_ADMIN_PASSWORD` are `undefined` inside the spec.

## Files to Change
- `backend/src/database/tests/worker-schema.db-spec.ts`: new canary spec.
