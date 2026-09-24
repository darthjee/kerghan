# Drop inferrable type in createdAtColumn
Change the signature to `createdAtColumn(name = 'created_at')`; the JSDoc already documents `{string} [name]`. Fixes `no-inferrable-types`.

## Files to Change
- `backend/src/database/migrations/helpers.ts` — drop the `: string` annotation on the defaulted parameter.
