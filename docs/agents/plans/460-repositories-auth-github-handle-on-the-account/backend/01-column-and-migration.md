# Column, entity and migration

Add `github_handle varchar(39) NULL` (default `null`, no index, no uniqueness) to `auth_users`. Follow the existing migration conventions (timestamp-prefixed file under `backend/src/database/migrations/`, the `AuthAdd…` class naming, `addColumn`/`dropColumn`, as in `20261017120020-auth-add-users-status.ts`). No backfill is needed: every existing row is `null`.

Map it on the `User` entity as `githubHandle: string | null` (`@Column({ name: 'github_handle', type: 'varchar', length: 39, nullable: true })`). Update the entity docblock: the handle is now stored on the account, owned by Auth.

## Files to Change
- `backend/src/database/migrations/<timestamp>-auth-add-users-github-handle.ts`: new migration (up adds the column, down drops it).
- `backend/src/auth/entities/user.entity.ts`: new nullable `githubHandle` column and an updated docblock.
