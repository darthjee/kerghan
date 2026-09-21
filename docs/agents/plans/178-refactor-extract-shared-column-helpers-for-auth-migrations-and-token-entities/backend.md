# Backend Plan: Refactor: extract shared column helpers for auth migrations and token entities

Main plan: [plan.md](plan.md)

## Overview
The auth `create table` migrations repeat the same `id`, `created_at` and `updated_at` column literals, and `RefreshToken` / `PasswordResetToken` repeat the same hashed-token fields. Add column-only helpers to `backend/src/database/migrations/helpers.ts`, use them in the six create-table migrations, and add an abstract `HashedTokenBase` for the two token entities. The produced DDL must be byte-identical; this is proven with a manual before/after `SHOW CREATE TABLE` diff.

## Context
- All work is inside `backend/` (single owner: `backend`).
- The create-table migrations use `new Table({ columns: [...] })` with plain `TableColumnOptions` literals. The `id` block (`{ name: 'id', type: 'int', isPrimary: true, isGenerated: true, generationStrategy: 'increment' }`) is identical in users, refresh-tokens, sessions, password-reset-tokens, account-edit-lockouts and authorization-requests (`20260903120008`).
- `created_at` is `{ name: 'created_at', type: 'datetime', default: 'CURRENT_TIMESTAMP' }` everywhere except refresh-tokens, which uses the same definition under the name `issued_at`. `updated_at` (`datetime`, default `CURRENT_TIMESTAMP`, `onUpdate: 'CURRENT_TIMESTAMP'`) is identical in users and account-edit-lockouts.
- Helpers cover column definitions only: per-table `user_id` index names/uniqueness and the `down()` `dropTable` one-liner stay in each migration.
- `helpers.ts` currently exports only `skipInProduction` and has no TypeORM import.
- The two token entities share `id`, unique-indexed `tokenHash`, `userId` and `expiresAt`; they differ in the created-timestamp column (`issuedAt` vs `createdAt`) and the nullable one (`revokedAt` vs `usedAt`). No relations are declared. There are no abstract base entities in `backend/src` yet.
- Migrations are loaded from `dist/database/migrations/*.js` (see `data-source.ts`), so the project must be built (`yarn build`) before every `migration:run` used for verification. There are no migration specs and `database/**` is excluded from Jest coverage.

## Steps

- [01 — Capture baseline schema](backend/01-capture-baseline-schema.md)
- [02 — Add column helpers and use them in migrations](backend/02-add-column-helpers-and-use-in-migrations.md)
- [03 — Add HashedTokenBase for token entities](backend/03-add-hashed-token-base.md)
- [04 — Verify identical schema and run checks](backend/04-verify-identical-schema-and-run-checks.md)

## CI Checks
- `backend`: `docker-compose run --rm kerghan_app yarn lint` (CI job: `backend_checks`)
- `backend`: `docker-compose run --rm kerghan_app yarn coverage` (CI job: `backend_tests`)

## Notes
- Never run `yarn`/`npm`/`php` on the host — always via `docker-compose` (project boundary).
- Keep controllers thin / no behavior change: this is a pure refactor, no schema, API or runtime behavior change is expected.
- Keep the existing ESLint convention of 4-space indentation on decorated entity fields.
- Name the base file `hashed-token.base.ts`, not `.entity.ts`, so it is not matched by the `dist/**/*.entity.js` entities glob (it has no `@Entity`).
- `@Index({ unique: true })` on the base's `tokenHash` is inherited by subclasses; since `synchronize` is off, generated index names in entity metadata are irrelevant to the database.
- jscpd is not wired into CI and has no committed baseline; the optional re-run in step 04 is a manual sanity check only. Do not install it on the host.
- Consider a one-line mention of the helpers in `docs/agents/architecture/backend.md` if its migrations section documents conventions for new tables.
