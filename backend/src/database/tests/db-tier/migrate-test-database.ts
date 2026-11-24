import { DataSource } from 'typeorm';
import {
  assertTestDatabase,
  buildDbTierOptions,
  loadMigrations,
  workerGrantPattern,
  workerSchemaNames,
} from './db-tier-options.js';

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

const SAFE_USER = /^[A-Za-z0-9_]+$/;

/**
 * Creates every worker schema and grants the app user access to them, through
 * an admin connection (the only place the admin credentials are read).
 *
 * @param env - the environment to read the connection settings from.
 * @param maxWorkers - how many worker schemas to create.
 * @returns resolves once the schemas exist and the grant is in place.
 */
export async function prepareWorkerSchemas(env: NodeJS.ProcessEnv, maxWorkers: number): Promise<void> {
  const { KERGHAN_MYSQL_ADMIN_USER: adminUser, KERGHAN_MYSQL_ADMIN_PASSWORD: adminPassword } = env;

  if (!adminUser || !adminPassword) {
    throw new Error(
      'DB test tier needs KERGHAN_MYSQL_ADMIN_USER and KERGHAN_MYSQL_ADMIN_PASSWORD to create the worker schemas.',
    );
  }

  const base = assertTestDatabase(env.KERGHAN_MYSQL_NAME);
  const appUser = env.KERGHAN_MYSQL_USER ?? '';

  if (!SAFE_USER.test(appUser)) throw new Error('KERGHAN_MYSQL_USER must match /^[A-Za-z0-9_]+$/.');

  const admin = await initializeWithRetry(new DataSource({
    type: 'mysql',
    host: env.KERGHAN_MYSQL_HOST,
    port: Number(env.KERGHAN_MYSQL_PORT ?? 3306),
    username: adminUser,
    password: adminPassword,
    multipleStatements: false,
  }));

  try {
    for (const name of workerSchemaNames(base, maxWorkers)) {
      await admin.query(`CREATE DATABASE IF NOT EXISTS \`${name}\``);
    }
    await admin.query(`GRANT ALL ON \`${workerGrantPattern(base)}\`.* TO '${appUser}'@'%'`);
  } finally {
    await admin.destroy();
  }
}

/**
 * Creates the worker schemas, waits for MySQL, applies every pending
 * migration to each worker schema (one transaction each), then disconnects.
 *
 * @param maxWorkers - how many worker schemas to prepare.
 * @returns resolves once migrations have been applied.
 */
export async function migrateTestDatabase(maxWorkers: number): Promise<void> {
  await prepareWorkerSchemas(process.env, maxWorkers);

  const base = assertTestDatabase(process.env.KERGHAN_MYSQL_NAME);
  const migrations = await loadMigrations();

  for (const name of workerSchemaNames(base, maxWorkers)) {
    const options = buildDbTierOptions({ ...process.env, KERGHAN_MYSQL_NAME: name }, migrations);
    const dataSource = await initializeWithRetry(new DataSource(options));

    try {
      await dataSource.runMigrations({ transaction: 'each' });
    } finally {
      await dataSource.destroy();
    }
  }
}
