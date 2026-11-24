import type { Config } from 'jest';
import baseConfig from './jest.base.cjs';

// DB-backed test tier (`yarn test:db`): runs only `*.db-spec.ts` files
// against a real MySQL test database. `KERGHAN_MYSQL_NAME` (ending in `_test`)
// is the *base* name: every Jest worker gets its own schema
// `<base without _test>_w<JEST_WORKER_ID>_test`. `globalSetup` creates and
// migrates one schema per worker (through an admin connection, using
// `KERGHAN_MYSQL_ADMIN_USER`/`_PASSWORD`), and the `worker-schema` setup file
// points each worker at its schema. Every test starts from empty tables via
// the `truncate-each` hook. `maxWorkers` is a fixed number, not a percentage,
// because `os.cpus()` reports the CI host's cores, not the container's quota;
// CI may override it with `--maxWorkers=<n>`. Never run with coverage.
const config: Config = {
  ...baseConfig,
  testRegex: '.*\\.db-spec\\.ts$',
  globalSetup: '<rootDir>/database/tests/db-tier/global-setup.ts',
  globalTeardown: '<rootDir>/database/tests/db-tier/global-teardown.ts',
  setupFiles: ['<rootDir>/database/tests/db-tier/worker-schema.ts'],
  maxWorkers: 2,
  setupFilesAfterEnv: ['<rootDir>/database/tests/db-tier/truncate-each.ts'],
  testTimeout: 30000,
};

export default config;
