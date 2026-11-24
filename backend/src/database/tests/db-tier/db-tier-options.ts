import { readdirSync } from 'fs';
import * as path from 'path';
import type { DataSourceOptions, MigrationInterface } from 'typeorm';

/** Suffix every DB-tier database name must carry, so a run can never touch dev/production data. */
export const TEST_DATABASE_SUFFIX = '_test';

/** Absolute path of the TypeScript migration sources. */
export const MIGRATIONS_DIR = path.join(__dirname, '..', '..', 'migrations');

// Only timestamp-prefixed files are migrations; `helpers.ts` must not be loaded.
const MIGRATION_FILE = /^[0-9].*\.ts$/;

type MigrationClass = new () => MigrationInterface;

/**
 * Throws unless the given database name ends in `_test`, so the DB-backed
 * test tier (which truncates every table) refuses to run against a dev or
 * production database.
 *
 * @param name - the configured database name (`KERGHAN_MYSQL_NAME`).
 * @returns the validated database name.
 */
export function assertTestDatabase(name: string | undefined): string {
  if (!name || !name.endsWith(TEST_DATABASE_SUFFIX)) {
    throw new Error(
      `DB test tier refuses to run: KERGHAN_MYSQL_NAME must end in "${TEST_DATABASE_SUFFIX}" (got "${name ?? ''}").`,
    );
  }

  return name;
}

/**
 * Builds the schema name of one Jest worker: the base name without its
 * trailing `_test`, plus `_w<workerId>_test`.
 *
 * @param base - the base database name (`KERGHAN_MYSQL_NAME`, ending in `_test`).
 * @param workerId - the 1-based Jest worker id.
 * @returns the worker schema name (for example `kerghan_w1_test`).
 */
export function workerSchemaName(base: string, workerId: number): string {
  assertTestDatabase(base);
  if (!Number.isInteger(workerId) || workerId < 1) {
    throw new Error(`DB test tier needs a positive integer worker id (got "${workerId}").`);
  }

  const prefix = base.slice(0, -TEST_DATABASE_SUFFIX.length);

  return assertTestDatabase(`${prefix}_w${workerId}${TEST_DATABASE_SUFFIX}`);
}

/**
 * Lists the schema names for workers `1..maxWorkers`.
 *
 * @param base - the base database name.
 * @param maxWorkers - how many workers Jest may run.
 * @returns the worker schema names, in worker order.
 */
export function workerSchemaNames(base: string, maxWorkers: number): string[] {
  return Array.from({ length: maxWorkers }, (_, index) => workerSchemaName(base, index + 1));
}

/**
 * Parses `JEST_WORKER_ID`. Never falls back to the base schema.
 *
 * @param env - the environment to read from.
 * @param maxWorkers - when given, the highest valid worker id.
 * @returns the worker id.
 */
export function resolveWorkerId(env: NodeJS.ProcessEnv, maxWorkers?: number): number {
  const raw = env.JEST_WORKER_ID;

  if (!raw || !/^[0-9]+$/.test(raw)) {
    throw new Error(`DB test tier needs a numeric JEST_WORKER_ID (got "${raw ?? ''}").`);
  }

  const workerId = Number(raw);

  if (workerId < 1 || (maxWorkers !== undefined && workerId > maxWorkers)) {
    throw new Error(`DB test tier: JEST_WORKER_ID ${workerId} is out of range (1..${maxWorkers ?? 'n'}).`);
  }

  return workerId;
}

/**
 * Builds the GRANT database pattern covering every worker schema.
 *
 * @param base - the base database name.
 * @returns the pattern, with `_` and `%` escaped in the prefix (`kerghan\_w%\_test`).
 */
export function workerGrantPattern(base: string): string {
  assertTestDatabase(base);

  const prefix = base.slice(0, -TEST_DATABASE_SUFFIX.length).replace(/[_%]/g, (char) => `\\${char}`);

  return `${prefix}\\_w%\\_test`;
}

/**
 * Loads every migration class from the TypeScript sources. The classes are
 * handed to TypeORM directly instead of a glob: for a `"type": "module"`
 * package TypeORM would native-`import()` the `.ts` files, bypassing Jest's
 * swc transform.
 *
 * @returns the migration classes, in file (timestamp) order.
 */
export async function loadMigrations(): Promise<MigrationClass[]> {
  const files = readdirSync(MIGRATIONS_DIR).filter((file) => MIGRATION_FILE.test(file)).sort();
  const modules: Array<Record<string, unknown>> = await Promise.all(
    files.map((file) => import(path.join(MIGRATIONS_DIR, file))),
  );

  return modules.flatMap((exported) => Object.values(exported))
    .filter((value): value is MigrationClass => typeof value === 'function');
}

/**
 * Builds the MySQL `DataSourceOptions` for the DB-backed test tier from the
 * app's own `KERGHAN_MYSQL_*` env vars.
 *
 * @param env - the environment to read the connection settings from.
 * @param migrations - the migration classes to register (see `loadMigrations`).
 * @returns the data source options, pointed at the (asserted) test database.
 */
export function buildDbTierOptions(
  env: NodeJS.ProcessEnv = process.env,
  migrations: MigrationClass[] = [],
): DataSourceOptions {
  return {
    type: 'mysql',
    host: env.KERGHAN_MYSQL_HOST,
    port: Number(env.KERGHAN_MYSQL_PORT ?? 3306),
    username: env.KERGHAN_MYSQL_USER,
    password: env.KERGHAN_MYSQL_PASSWORD,
    database: assertTestDatabase(env.KERGHAN_MYSQL_NAME),
    poolSize: 5,
    multipleStatements: false,
    entities: [],
    migrations,
  };
}
