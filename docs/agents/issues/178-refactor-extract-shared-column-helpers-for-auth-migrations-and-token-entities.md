# Issue: Refactor: extract shared column helpers for auth migrations and token entities

## Description
The auth `create table` migrations and two token entities repeat the same column definitions.

## Problem
- jscpd finds the recently added `backend/src/database/migrations/20260914120010-auth-create-account-edit-lockouts.ts` overlapping four earlier create-table migrations: `20260824120002-auth-create-refresh-tokens.ts` (16 lines), `20260824120003-auth-create-sessions.ts` (15), `20260901120005-auth-create-password-reset-tokens.ts` (14) and `20260824120001-auth-create-users.ts` (14). The repeated blocks are the auto-increment `id` primary key column and the `created_at` default-`CURRENT_TIMESTAMP` column (plus their indices/`down()` scaffolding).
- `20260903120008-auth-create-authorization-requests.ts` repeats the same `id` and `created_at` blocks and is also affected. The `updated_at` block (`datetime`, default `CURRENT_TIMESTAMP`, `onUpdate: CURRENT_TIMESTAMP`) is likewise identical in users and account-edit-lockouts.
- `refresh-tokens` has no `created_at`: it uses `issued_at` with the same type and default, so a shared `created_at` helper must accept a column name.
- `backend/src/auth/entities/password-reset-token.entity.ts` lines 23-34 ↔ `refresh-token.entity.ts` lines 22-33 (12 lines): both declare `id`, a unique `token_hash`, `user_id`, `expires_at` and a nullable used/revoked timestamp. They differ only in the created-timestamp column (`issuedAt` vs `createdAt`) and the nullable one (`revokedAt` vs `usedAt`); neither declares relations.
- `backend/src/database/migrations/helpers.ts` already exists (with `skipInProduction`) as the natural home for shared migration helpers. There are no abstract base entities in `backend/src` yet.

## Expected Behavior
Migrations use shared column-definition helpers (`idColumn()`, `createdAtColumn(name = 'created_at')`, `updatedAtColumn()`), and the two token entities extend a small abstract `HashedTokenBase` for the shared hashed-token fields. The resulting database schema is identical.

## Solution
- Add `idColumn()`, `createdAtColumn(name = 'created_at')` and `updatedAtColumn()` to `backend/src/database/migrations/helpers.ts`, returning `TableColumnOptions` (`import type { TableColumnOptions } from 'typeorm'`). Helpers cover **column definitions only** — per-table `user_id` index names/uniqueness and the `down()` `dropTable` one-liner stay in each migration.
- Use them in the create-table migrations: users, refresh-tokens (via `createdAtColumn('issued_at')`), sessions, password-reset-tokens, account-edit-lockouts and authorization-requests.
- Add an abstract `HashedTokenBase` in `backend/src/auth/entities/hashed-token.base.ts` (named `.base.ts`, not `.entity.ts`, so it is not picked up by the `dist/**/*.entity.js` glob) declaring `id`, the unique-indexed `tokenHash`, `userId` and `expiresAt`. `RefreshToken` and `PasswordResetToken` extend it and keep their own created-timestamp and revoked/used columns. Keep the existing 4-space decorated-field indentation convention.
- Verification of an identical schema (manual, no new test infrastructure): via `docker-compose`, run the migrations on a fresh MySQL before the change and dump `SHOW CREATE TABLE` for each `auth_*` table; after the change, rebuild (`dist/` migrations are what run), re-migrate on a fresh DB and diff the dumps. Also run `migration:revert`. Already-applied migrations must not change behavior.
- Optionally re-run jscpd manually via `docker-compose` (e.g. `npx jscpd src/database src/auth/entities` inside the app container) to confirm the reported blocks are gone; jscpd is not wired into CI and no baseline is committed.

## Benefits
Future tables reuse the helpers instead of copy-pasting boilerplate, and the token entities' shared shape is stated once.
