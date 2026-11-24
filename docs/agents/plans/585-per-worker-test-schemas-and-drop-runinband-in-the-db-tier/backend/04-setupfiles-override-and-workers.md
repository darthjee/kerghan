# Per-worker override in setupFiles and drop --runInBand

Add `backend/src/database/tests/db-tier/worker-schema.ts`, registered under `setupFiles` (not `setupFilesAfterEnv`) in `jest.db.config.ts`, so it runs before the spec imports anything (`src/database/data-source.ts` reads `process.env` when it's imported, and `AppModule` reads it through ConfigService):

- `process.env.KERGHAN_MYSQL_BASE_NAME ??= process.env.KERGHAN_MYSQL_NAME`
- `process.env.KERGHAN_MYSQL_NAME = workerSchemaName(base, resolveWorkerId(process.env))`
- `delete process.env.KERGHAN_MYSQL_ADMIN_USER; delete process.env.KERGHAN_MYSQL_ADMIN_PASSWORD;`

`buildDbTierOptions`, `getTestDataSource`, `openEntityDataSource` and every `build-*-test-app.ts` / `*-harness.ts` keep reading `KERGHAN_MYSQL_NAME` unchanged.

In `jest.db.config.ts`: add `setupFiles`, set `maxWorkers: 2`, and update the header comment to explain per-worker schemas, the base-name meaning of `KERGHAN_MYSQL_NAME`, and why the worker count is fixed rather than a percentage (`os.cpus()` reports the CircleCI host's cores). In `backend/package.json`: change `test:db` to `jest --config jest.db.config.ts` (drop `--runInBand`).

## Files to Change
- `backend/src/database/tests/db-tier/worker-schema.ts`: new `setupFiles` hook.
- `backend/jest.db.config.ts`: `setupFiles`, `maxWorkers: 2`, header comment.
- `backend/package.json`: drop `--runInBand` from `test:db`.
