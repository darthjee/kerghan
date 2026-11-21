# Static specs and lint boundary

The static specs of `testing.md#security-verification` that apply to a module skeleton, modelled on Repositories' static specs:

- `module-sources.ts` support: `ISSUES_ROOT` and `moduleSources()` (non-test `.ts` under `src/issues/`).
- `no-sql-now.spec.ts`: no `NOW(`, `CURRENT_TIMESTAMP`, `SYSDATE(`, `UTC_TIMESTAMP`, `Date.now()` or `new Date()` in the Issues sources.
- `module-boundaries.spec.ts`: no `fetch(`, no `secret_iv` and no `auth_users` / `integrations` table use in SQL. No entity maps to an Auth or Integrations table: check `getMetadataArgsStorage()` restricted to `ISSUES_ENTITIES`.
- `column-allowlist.spec.ts`: each Issues entity's columns equal an explicit allowlist taken from `model.md`. The marker's allowlist is exactly `id`, `link_id`, `revision`, `marked_at`, `updated_at` (no payload column).
- ESLint boundary: add an `src/issues/**/*.ts` override to `backend/eslint.config.mjs`, mirroring the Repositories one, that refuses imports of Auth and Integrations internals. Only `AccountHandleService`, the Integrations public entry and `RepositoriesService` are allowed. Add an `eslint-boundary.spec.ts` that proves the rule fires.

Do not change the cache-policy coverage spec: #553 adds no controller.

## Files to Change
- `backend/src/issues/tests/support/module-sources.ts` — new.
- `backend/src/issues/tests/no-sql-now.spec.ts` — new.
- `backend/src/issues/tests/module-boundaries.spec.ts` — new.
- `backend/src/issues/tests/column-allowlist.spec.ts` — new.
- `backend/src/issues/tests/eslint-boundary.spec.ts` — new.
- `backend/eslint.config.mjs` — the Issues boundary override.
