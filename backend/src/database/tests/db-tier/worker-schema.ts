import { resolveWorkerId, workerSchemaName } from './db-tier-options.js';

// `setupFiles` hook for the DB-backed tier: points this Jest worker at its own
// schema before any spec code (data-source.ts, ConfigService) reads the env.
// `KERGHAN_MYSQL_NAME` is the base name in the container; the base is stashed
// in `KERGHAN_MYSQL_BASE_NAME` so the override stays idempotent.
process.env.KERGHAN_MYSQL_BASE_NAME ??= process.env.KERGHAN_MYSQL_NAME;
process.env.KERGHAN_MYSQL_NAME = workerSchemaName(
  process.env.KERGHAN_MYSQL_BASE_NAME ?? '',
  resolveWorkerId(process.env),
);

// The admin credentials are only for `globalSetup`; specs must never see them.
delete process.env.KERGHAN_MYSQL_ADMIN_USER;
delete process.env.KERGHAN_MYSQL_ADMIN_PASSWORD;
