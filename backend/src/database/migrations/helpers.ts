/**
 * Guards a migration's `up()` against running against a production database.
 * Migrations run via the TypeORM CLI, outside the Nest DI lifecycle, so this
 * relies on `process.env.STAGE` directly and logs via raw `console` (no
 * `LoggerService` available) instead of the DI-injected patterns used
 * elsewhere in the app.
 *
 * @param migrationName - the migration class name, used in the warning message.
 * @param action - a short description of the skipped action, used in the warning message.
 * @returns whether the migration should skip its `up()` logic (true when `STAGE=production`).
 */
export function skipInProduction(migrationName: string, action: string): boolean {
  if (process.env.STAGE !== 'production') return false;

  // Raw console: migrations run via the TypeORM CLI, outside the Nest DI lifecycle — no LoggerService available.
  // eslint-disable-next-line no-console
  console.warn(`Skipping ${migrationName}: STAGE=production, refusing to ${action}.`);
  return true;
}
