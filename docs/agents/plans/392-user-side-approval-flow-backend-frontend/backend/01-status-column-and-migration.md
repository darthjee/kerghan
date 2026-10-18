# Status column, entity and migration

Add `UserStatus` (exported const + type, the same pattern as `RevokedReason` in
`entities/refresh-token.entity.ts`) and a `status` column on `User`: `varchar(16)`, NOT NULL,
**no `default`** in the entity (model.md: the creating service always sets it explicitly).

New migration `backend/src/database/migrations/<timestamp>-auth-add-users-status.ts` (next
timestamp after `20261009120019`, class name in the existing `Auth…<timestamp>` style). `up`:
add the column as nullable, `UPDATE auth_users SET status = 'approved'` (every row, including
the demo seed users), then change it to NOT NULL; `down`: drop the column. Do **not** guard it
with `skipInProduction`: the backfill is mandatory everywhere. Follow
`20261005120018-auth-add-refresh-tokens-revoked-reason.ts` for shape.

Also add `ErrorCodes.USER_DENIED` (`core/error-codes.ts`) and
`RevokedReason.ADMIN_DENIED = 'admin_denied'` (`entities/refresh-token.entity.ts`, keeping the
column length in mind: `varchar(32)`).

Tests: migration spec (if migrations have specs in `database/tests`), otherwise the e2e status
tests below cover the column. model.md "Migration" required test: existing users `approved`
after `up`.

## Files to Change
- `backend/src/auth/entities/user.entity.ts` — `UserStatus` and `status` column.
- `backend/src/database/migrations/<timestamp>-auth-add-users-status.ts` — new migration.
- `backend/src/core/error-codes.ts` — `USER_DENIED`.
- `backend/src/auth/entities/refresh-token.entity.ts` — `ADMIN_DENIED`.
