# Module skeleton, entities and migrations

Create the module and its five tables exactly as in `model.md#tables`: columns, lengths, nullability, the `source_key varchar(32)` convention (`integration:<id>` | `handle`), and every index named `idx_<table>_<cols>`.

- **Migrations:** one migration per table, timestamp-prefixed after `20261110120021`:
  - `…-repositories-create-repositories.ts`
  - `…-repositories-create-repositories-sources.ts`
  - `…-repositories-create-repositories-source-pages.ts`
  - `…-repositories-create-repositories-sync-states.ts`
  - `…-repositories-create-repositories-source-statuses.ts`

  Follow the `integrations-create-*` migrations, reusing `migrations/helpers.ts` where it fits.
  - There are no physical FKs (logical FKs only, `model.md#logical-foreign-keys`).
  - `repositories_sync_states` has `user_id` as its primary key (no auto-increment `id`).
  - Each `down` drops its table.
- **Entities** (`repositories/entities/`): `Repository` (name it `RepositoryRecord` or similar to avoid clashing with TypeORM's `Repository`), `RepositorySource`, `RepositorySourcePage`, `RepositorySyncState`, `RepositorySourceStatus`.
  - `github_id` is `bigint` with a `{ from: Number, to: (v) => v }` transformer.
  - Timestamps are plain `datetime` columns that the code writes from `Clock`. `@CreateDateColumn` / `@UpdateDateColumn` are acceptable for `created_at` / `updated_at` only.
- **Source keys:** a small `source-key.ts` with `integrationSourceKey(id)`, `HANDLE_SOURCE_KEY = 'handle'` and `parseSourceKey()`.
- **Values** (`repositories-config.ts`):
  - read `KERGHAN_REPOSITORIES_SYNC_TTL_MS` (3600000), `_COOLDOWN_MS` (300000) and `_PAGE_CAP` (10) with `getNumberConfig`; any value that is not a positive integer falls back to the default (`sync.md#values`);
  - constants: lease 2 min, hard deadline 5 min, parallelism 3, `per_page` 100 (the Integrations client owns the GitHub timeout and the budget thresholds).
- **`SyncLauncher`** (`sync-launcher.ts`): an abstract class used as the DI token, with `launch(task: () => Promise<void>): void`. `DetachedSyncLauncher` starts the task without awaiting it and catches and logs (safe fields) anything it throws. The run's own catch-all release lives in the run (step 04).
- **Module:**
  - `repositories.module.ts` imports `TypeOrmModule.forFeature([...5 entities])`, `AuthModule` and `IntegrationsModule`;
  - it provides `{ provide: Clock, useClass: SystemClock }` and `{ provide: SyncLauncher, useClass: DetachedSyncLauncher }`;
  - it is registered in `AppModule.imports`, always-on, so the listeners exist at boot;
  - it exports the service of step 06.
- **Test support** (`repositories/tests/support/`):
  - `CapturingLauncher`: records tasks; `runAll()` runs every captured task (including ones queued while running) and resolves once they settle; `runNext()` supports step-by-step race specs;
  - a builder for a two-user baseline (`testing.md#two-user-baseline`);
  - a DB-tier harness that builds a Nest testing module on `getTestDataSource()`'s options with `FakeClock`, `CapturingLauncher` and `FakeIntegrationsGithubService` overridden.
- **Tests:**
  - `(db)`: migrations up and down; a duplicate (`user_id`, `github_id`) is rejected while two users can each hold one; a `github_id` above 2³¹ round-trips exactly; `source_key` uniqueness on sources, pages and statuses;
  - `(unit)`: the env defaults and fallbacks, and the source-key helpers.

## Files to Change
- `backend/src/database/migrations/<20261113120022…26>-repositories-create-*.ts`: new, the five tables.
- `backend/src/repositories/entities/*.entity.ts`: new, the five entities.
- `backend/src/repositories/source-key.ts`, `repositories-config.ts`, `sync-launcher.ts`, `repositories.module.ts`: new.
- `backend/src/app.module.ts`: import `RepositoriesModule`.
- `backend/src/repositories/tests/support/{capturing-launcher,two-user-baseline,repositories-db-harness}.ts`: new.
- `backend/src/repositories/tests/repositories-config.spec.ts`, `source-key.spec.ts`: new.
- `backend/src/database/tests/repositories-migrations.db-spec.ts` and `backend/src/repositories/tests/repositories-tables.db-spec.ts`: new.
