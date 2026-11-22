import { DataSource, DataSourceOptions } from 'typeorm';
import { buildDbTierOptions } from './db-tier-options.js';

const MIGRATIONS_TABLE = 'migrations';

let dataSource: DataSource | undefined;
let initializing: Promise<DataSource> | undefined;

/**
 * Returns the test file's shared data source, initializing it on first use.
 * Migrations are not loaded here: `globalSetup` already applied them.
 *
 * @returns the initialized data source for the current test file.
 */
export function getTestDataSource(): Promise<DataSource> {
  if (!initializing) {
    dataSource = new DataSource({ ...buildDbTierOptions(), migrations: [] });
    initializing = dataSource.initialize();
  }

  return initializing;
}

/**
 * Destroys the test file's shared data source, if one was opened.
 *
 * @returns resolves once the connection pool is closed.
 */
export async function destroyTestDataSource(): Promise<void> {
  const current = dataSource;

  dataSource = undefined;
  initializing = undefined;
  if (current?.isInitialized) await current.destroy();
}

/**
 * Empties every table in the current schema except `migrations`, on a
 * single query runner so the foreign-key toggle applies to the same
 * connection as the truncates.
 *
 * @param ds - the data source (or a promise of it) to truncate.
 * @returns resolves once every table is empty.
 */
export async function truncateAll(ds: DataSource | Promise<DataSource>): Promise<void> {
  const runner = (await ds).createQueryRunner();

  try {
    const tables: Array<{ name: string }> = await runner.query(
      'SELECT table_name AS name FROM information_schema.tables '
      + "WHERE table_schema = DATABASE() AND table_type = 'BASE TABLE' AND table_name <> ?",
      [MIGRATIONS_TABLE],
    );

    await runner.query('SET FOREIGN_KEY_CHECKS = 0');
    try {
      for (const { name } of tables) {
        await runner.query(`TRUNCATE TABLE \`${name}\``);
      }
    } finally {
      await runner.query('SET FOREIGN_KEY_CHECKS = 1');
    }
  } finally {
    await runner.release();
  }
}

type TruncatedHook = () => Promise<void>;

const truncatedHooks = new Set<TruncatedHook>();

/**
 * Registers a hook run after every per-test truncate (before the test's own `beforeEach`), so a
 * harness can re-seed the rows it promises every test (e.g. the intruder user).
 *
 * @param hook - the async seeding callback.
 * @returns a function that unregisters the hook (call it when the harness closes).
 */
export function onTruncated(hook: TruncatedHook): () => void {
  truncatedHooks.add(hook);

  return () => {
    truncatedHooks.delete(hook);
  };
}

/**
 * Runs the registered post-truncate hooks, in registration order.
 *
 * @returns resolves once every hook has finished.
 */
export async function runTruncatedHooks(): Promise<void> {
  for (const hook of truncatedHooks) await hook();
}

type EntityClass = NonNullable<DataSourceOptions['entities']> extends Array<infer T> ? T : never;

/**
 * Opens a separate data source on the test database with the given entity
 * classes registered, for specs that exercise TypeORM repositories or
 * services. The caller destroys it (typically in `afterAll`).
 *
 * @param entities - the entity classes to register.
 * @returns the initialized data source.
 */
export async function openEntityDataSource(entities: EntityClass[]): Promise<DataSource> {
  const dataSource = new DataSource({ ...buildDbTierOptions(), migrations: [], entities, poolSize: 10 });

  return dataSource.initialize();
}
