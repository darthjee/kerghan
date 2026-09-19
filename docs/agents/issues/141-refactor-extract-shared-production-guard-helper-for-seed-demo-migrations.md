# Issue: Refactor: extract shared production-guard helper for seed/demo migrations

## Description
Two seed/demo migrations each start `up()` with an identical, custom "refuse to run in production" guard block.

## Problem
`backend/src/database/migrations/20260824120004-auth-seed-demo-user.ts` and
`backend/src/database/migrations/20260903120007-auth-promote-demo-user-admin.ts` both begin `up()` with:

```ts
if (process.env.STAGE === 'production') {
  // eslint-disable-next-line no-console
  console.warn(`Skipping ${ClassName.name}: STAGE=production, refusing to ...`);
  return;
}
```

Unlike typical TypeORM `createTable`/`dropTable` scaffolding, this is custom safety logic specific to this project, duplicated verbatim (modulo the warning text) across two files — with real risk that a future demo/seed migration forgets to copy the guard and accidentally runs against production.

## Expected Behavior
Every demo/seed migration that must not run in production uses the same guard helper; existing migrations behave identically (still skipped when `STAGE=production`, same warning intent).

## Solution
Extract a shared helper, `skipInProduction(migrationName: string, action: string): boolean`, in a new `backend/src/database/migrations/helpers.ts`, and update both migrations to call it:

```ts
if (skipInProduction(AuthSeedDemoUser20260824120004.name, 'seed the demo user')) return;
```

The helper owns both the `STAGE` check and the `console.warn` call — it builds the warning message itself from `migrationName` and `action` (e.g. `` `Skipping ${migrationName}: STAGE=production, refusing to ${action}.` ``), so each call site no longer needs its own `console.warn`/eslint-disable line. This fully eliminates the duplication, including the warning text, while each migration still supplies its own action-specific wording via the `action` argument.

No such helpers file exists yet for migrations, so this introduces the first one, inside the existing `backend/src/database/migrations/` directory (not a new top-level folder).

## Benefits
Makes the production-safety guard for demo/seed data a documented, reusable pattern instead of copy-paste logic that a future migration author could easily forget.
