import type { Config } from 'jest';
// Node (22.18+) loads Jest's TypeScript configs as native ES modules with
// type stripping, so the import must name the real `.ts` file; Jest's
// ts-node typecheck pass otherwise rejects the extension (TS5097).
// @ts-expect-error TS5097 — `.ts` extension needed by Node's native loader.
import { baseConfig } from './jest.config.ts';

// DB-backed test tier (`yarn test:db`): runs only `*.db-spec.ts` files
// against a real MySQL test database (`KERGHAN_MYSQL_NAME` must end in
// `_test`). Migrations run once per run in `globalSetup`; every test starts
// from empty tables via the `truncate-each` hook. Never run with coverage.
const config: Config = {
  ...baseConfig,
  testRegex: '.*\\.db-spec\\.ts$',
  globalSetup: '<rootDir>/database/tests/db-tier/global-setup.ts',
  globalTeardown: '<rootDir>/database/tests/db-tier/global-teardown.ts',
  setupFilesAfterEnv: ['<rootDir>/database/tests/db-tier/truncate-each.ts'],
  testTimeout: 30000,
};

export default config;
