# Create the `auth_account_edit_lockouts` table and entity

Add a new TypeORM migration creating `auth_account_edit_lockouts`, following the same
create-table shape as `20260901120005-auth-create-password-reset-tokens.ts`: an `id` primary key,
`user_id` (logical FK into `auth_users`, unique — one row per user, upserted in place rather than
appended), `failed_attempts` (int, default `0`), `locked_until` (datetime, nullable),
`created_at`/`updated_at` (datetime). Add a unique index on `user_id` so the guard service can
`findOne`/`update` by it directly.

Add the matching entity `AccountEditLockout` (`backend/src/auth/entities/account-edit-lockout.ts`),
following `AuthorizationRequest`'s column-naming style (`@Column({ name: 'snake_case', ... })`
with camelCase TS properties), and register it in `AuthModule`'s `TypeOrmModule.forFeature([...])`
array (`backend/src/auth/auth.module.ts`).

## Files to Change

- `backend/src/database/migrations/<timestamp>-auth-create-account-edit-lockouts.ts` — new
  migration creating the table (mirror `20260901120005-auth-create-password-reset-tokens.ts`'s
  shape: `Table` + `TableIndex` on `user_id`, `unique: true`).
- `backend/src/auth/entities/account-edit-lockout.entity.ts` — new `AccountEditLockout` entity:
  `id`, `userId` (unique), `failedAttempts` (default `0`), `lockedUntil` (nullable), `createdAt`,
  `updatedAt`.
- `backend/src/auth/auth.module.ts` — add `AccountEditLockout` to `TypeOrmModule.forFeature([...])`.
