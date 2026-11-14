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
