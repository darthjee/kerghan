# Backend Plan: Refactor: extract shared production-guard helper for seed/demo migrations

Main plan: [plan.md](plan.md)

## Implementation Steps

### Step 1 — Add the shared `skipInProduction` helper
Create `backend/src/database/migrations/helpers.ts` (no such helpers file exists yet for migrations) exporting:

```ts
export function skipInProduction(migrationName: string, action: string): boolean {
  if (process.env.STAGE !== 'production') return false;

  // Raw console: migrations run via the TypeORM CLI, outside the Nest DI lifecycle — no LoggerService available.
  // eslint-disable-next-line no-console
  console.warn(`Skipping ${migrationName}: STAGE=production, refusing to ${action}.`);
  return true;
}
```

This owns both the `STAGE` check and the `console.warn` call, matching the exact wording both existing migrations already use ("Skipping `<ClassName>`: STAGE=production, refusing to `<action>`.").

### Step 2 — Update both migrations to call the helper
Replace the inline guard block in each migration's `up()` with a call to `skipInProduction`, removing the now-redundant `console.warn`/`eslint-disable-next-line no-console` lines and their doc-comment justification for the raw `console` usage (that justification now lives once, in `helpers.ts`):

- `backend/src/database/migrations/20260824120004-auth-seed-demo-user.ts`:
  ```ts
  if (skipInProduction(AuthSeedDemoUser20260824120004.name, 'seed the demo user')) return;
  ```
- `backend/src/database/migrations/20260903120007-auth-promote-demo-user-admin.ts`:
  ```ts
  if (skipInProduction(AuthPromoteDemoUserAdmin20260903120007.name, 'promote the demo user to admin')) return;
  ```

Both migrations import `skipInProduction` from `./helpers.js` (this repo's NodeNext-style imports use explicit `.js` extensions on relative imports even for `.ts` source — see the existing imports in these files for the pattern). Runtime behavior must stay identical: same skip condition, same warning text, same early `return`.

## Files to Change
- `backend/src/database/migrations/helpers.ts` — new file, adds `skipInProduction(migrationName, action): boolean`.
- `backend/src/database/migrations/20260824120004-auth-seed-demo-user.ts` — replace inline guard with `skipInProduction(...)` call.
- `backend/src/database/migrations/20260903120007-auth-promote-demo-user-admin.ts` — replace inline guard with `skipInProduction(...)` call.

## CI Checks
- `backend`: `docker-compose run --rm kerghan_tests yarn lint` (CI job: `backend_checks`)
- `backend`: `docker-compose run --rm kerghan_tests yarn coverage` (CI job: `backend_tests`)

## Notes
- No test file is needed for `helpers.ts`: `backend/jest.config.ts`'s `collectCoverageFrom` excludes `database/**` entirely (migrations/helpers are exercised via `yarn migration:run`/`migration:revert` against a real database, per `docs/agents/architecture/backend.md`, not unit tests), so this stays consistent with the existing convention — no new coverage gap is introduced either way.
- This is a pure refactor: no schema change, no new migration, and no change to `up()`/`down()` behavior for either existing migration.
