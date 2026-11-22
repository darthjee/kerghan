import { destroyTestDataSource, getTestDataSource, runTruncatedHooks, truncateAll } from './db-tier.js';

// `setupFilesAfterEnv` hook for the DB-backed tier: every test starts from
// empty tables (the seeded demo user included; harnesses may re-seed through `onTruncated`), and each test file closes
// its shared connection when done.
beforeEach(async () => {
  await truncateAll(getTestDataSource());
  await runTruncatedHooks();
});

afterAll(() => destroyTestDataSource());
