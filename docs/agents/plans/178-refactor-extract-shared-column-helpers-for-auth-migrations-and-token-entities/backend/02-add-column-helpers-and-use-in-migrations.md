# Add column helpers and use them in migrations
Add three helpers to `helpers.ts`, each returning a `TableColumnOptions` (add `import type { TableColumnOptions } from 'typeorm'`), with JSDoc in the same style as `skipInProduction`:

- `idColumn()` → `{ name: 'id', type: 'int', isPrimary: true, isGenerated: true, generationStrategy: 'increment' }`
- `createdAtColumn(name = 'created_at')` → `{ name, type: 'datetime', default: 'CURRENT_TIMESTAMP' }`
- `updatedAtColumn()` → `{ name: 'updated_at', type: 'datetime', default: 'CURRENT_TIMESTAMP', onUpdate: 'CURRENT_TIMESTAMP' }`

Then replace the inline literals in the six create-table migrations with calls to them, keeping column order unchanged (column order is part of the DDL): `idColumn()` where the `id` block appears, `createdAtColumn()` for `created_at` (and `createdAtColumn('issued_at')` in refresh-tokens), `updatedAtColumn()` in users and account-edit-lockouts. Leave indexes and `down()` untouched. Do not edit any other migration (seed/promote/`addColumn` migrations are not candidates), and do not change any migration's class name or timestamp.

## Files to Change
- `backend/src/database/migrations/helpers.ts` — add `idColumn`, `createdAtColumn`, `updatedAtColumn` and the `TableColumnOptions` type import
- `backend/src/database/migrations/20260824120001-auth-create-users.ts` — use `idColumn()`, `createdAtColumn()`, `updatedAtColumn()`
- `backend/src/database/migrations/20260824120002-auth-create-refresh-tokens.ts` — use `idColumn()`, `createdAtColumn('issued_at')`
- `backend/src/database/migrations/20260824120003-auth-create-sessions.ts` — use `idColumn()`, `createdAtColumn()`
- `backend/src/database/migrations/20260901120005-auth-create-password-reset-tokens.ts` — use `idColumn()`, `createdAtColumn()`
- `backend/src/database/migrations/20260903120008-auth-create-authorization-requests.ts` — use `idColumn()`, `createdAtColumn()`
- `backend/src/database/migrations/20260914120010-auth-create-account-edit-lockouts.ts` — use `idColumn()`, `createdAtColumn()`, `updatedAtColumn()`
