import type { Config } from 'jest';
import baseConfig from './jest.base.cjs';

// Shared rootDir, swc transform and `.js` -> `.ts` module resolution live
// in `jest.base.cjs` (also used by the DB-backed tier's `jest.db.config.ts`).

// `*.db-spec.ts` files (the DB-backed tier, `yarn test:db`) never match
// this `testRegex`: `.db-spec` is neither `.spec` nor `.e2e-spec`.
const config: Config = {
  ...baseConfig,
  testRegex: '.*\\.(spec|e2e-spec)\\.ts$',
  collectCoverageFrom: [
    '**/*.(t|j)s',
    '!**/*.spec.ts',
    '!**/*.e2e-spec.ts',
    '!**/*.db-spec.ts',
    // Bootstrap/wiring and TypeORM migrations are exercised by booting the
    // app and by `yarn migration:run`/`migration:revert` against a real
    // database (see docs/agents/architecture/backend.md), not by unit
    // tests — excluded here the same way `nest new`'s default Jest config
    // excludes `main.ts`. The `integrations-keys` CLI entrypoint is the same
    // kind of thin bootstrap (all its logic lives in the unit-tested
    // `IntegrationsKeyRotationService`).
    '!main.ts',
    '!integrations/cli/**',
    '!app.module.ts',
    '!mail/mail.module.ts',
    '!database/**',
  ],
  coverageDirectory: '../coverage',
};

export default config;
