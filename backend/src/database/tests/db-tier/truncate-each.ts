import { destroyTestDataSource, getTestDataSource, truncateAll } from './db-tier.js';

// `setupFilesAfterEnv` hook for the DB-backed tier: every test starts from
// empty tables (the seeded demo user included), and each test file closes
// its shared connection when done.
beforeEach(() => truncateAll(getTestDataSource()));

afterAll(() => destroyTestDataSource());
