import { DataSource } from 'typeorm';
import { buildDbTierOptions, loadMigrations } from './db-tier-options.js';

const READY_TIMEOUT_MS = 60_000;
const RETRY_INTERVAL_MS = 1_000;

/**
 * Initializes the data source, retrying every second until MySQL accepts
 * connections or the timeout elapses — so neither compose nor CI needs a
 * separate wait step.
 *
 * @param dataSource - the (not yet initialized) data source.
 * @returns the initialized data source.
 */
async function initializeWithRetry(dataSource: DataSource): Promise<DataSource> {
  const deadline = Date.now() + READY_TIMEOUT_MS;

  for (;;) {
    try {
      return await dataSource.initialize();
    } catch (error) {
      if (Date.now() >= deadline) throw error;
      await new Promise((resolve) => setTimeout(resolve, RETRY_INTERVAL_MS));
    }
  }
}

/**
 * Asserts the test database name, waits for MySQL, applies every pending
 * migration (one transaction each), then disconnects.
 *
 * @returns resolves once migrations have been applied.
 */
export async function migrateTestDatabase(): Promise<void> {
  const options = buildDbTierOptions(process.env, await loadMigrations());
  const dataSource = await initializeWithRetry(new DataSource(options));

  try {
    await dataSource.runMigrations({ transaction: 'each' });
  } finally {
    await dataSource.destroy();
  }
}
