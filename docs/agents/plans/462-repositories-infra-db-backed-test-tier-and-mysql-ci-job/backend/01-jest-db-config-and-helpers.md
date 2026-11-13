# Jest DB config, script and tier helpers

Add a separate Jest config and the helpers that make each run safe and repeatable.

1. **`backend/jest.db.config.ts`:**
   - same `rootDir`, `transform` and `moduleNameMapper` as `jest.config.ts`; import and spread the shared parts rather than copying them, for example by exporting a `baseConfig` from `jest.config.ts`;
   - `testRegex: '.*\\.db-spec\\.ts$'`;
   - `globalSetup` and `globalTeardown` pointing at the helpers below;
   - `setupFilesAfterEnv` pointing at the per-test truncation hook;
   - no coverage settings, and a generous `testTimeout` (for example 30 s).
2. **`backend/package.json`:** add `"test:db": "jest --config jest.db.config.ts --runInBand"`.
3. **`backend/src/database/tests/db-tier/`** (excluded from the build by `tsconfig.build.json`'s `src/**/tests/**`):
   - **`db-tier-options.ts`:** builds the MySQL `DataSourceOptions` from the `KERGHAN_MYSQL_*` env vars, using the TypeScript migration glob, `multipleStatements: false` and a pool size of 5. `assertTestDatabase(name)` throws unless the name ends in `_test`.
   - **`global-setup.ts`:**
     - asserts the test database name;
     - retries `DataSource.initialize()` every second for up to 60 s;
     - runs `runMigrations({ transaction: 'each' })`;
     - destroys the connection.

     Migrations therefore run once per run.
   - **`global-teardown.ts`:** a no-op, unless a dangling connection needs closing.
   - **`db-tier.ts`:** exports `getTestDataSource()`, a lazily initialised `DataSource` shared per test file and destroyed in `afterAll`, and `truncateAll(ds)`:
     - reads `information_schema.tables` for the current schema, skipping `migrations`;
     - runs `SET FOREIGN_KEY_CHECKS = 0`, a `TRUNCATE TABLE \`<name>\`` for each table, then `SET FOREIGN_KEY_CHECKS = 1`;
     - does it all on one query runner, so the FK toggle applies to the same connection.
   - **`truncate-each.ts`:** the `setupFilesAfterEnv` file. It registers `beforeEach(() => truncateAll(getTestDataSource()))` and `afterAll` cleanup.

   Truncating also wipes the seeded demo user. That is intended: each test starts empty.

## Files to Change
- `backend/jest.db.config.ts`: new, the DB tier Jest config.
- `backend/jest.config.ts`: export the shared base, and exclude `*.db-spec.ts` from coverage.
- `backend/package.json`: the `test:db` script.
- `backend/src/database/tests/db-tier/db-tier-options.ts`: new.
- `backend/src/database/tests/db-tier/global-setup.ts`: new.
- `backend/src/database/tests/db-tier/global-teardown.ts`: new.
- `backend/src/database/tests/db-tier/db-tier.ts`: new.
- `backend/src/database/tests/db-tier/truncate-each.ts`: new.
