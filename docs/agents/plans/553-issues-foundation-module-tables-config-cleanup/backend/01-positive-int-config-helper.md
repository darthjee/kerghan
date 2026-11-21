# Shared positive-integer config helper

Add `getPositiveIntConfig(configService, key, fallback)` to `core/numeric-config.ts`. It returns the value parsed by `getNumberConfig` when that value is a positive integer, and otherwise returns `fallback` (unset, non-numeric, `0`, negative, fractional). It is the private `positiveInteger()` of `RepositoriesConfig` moved to `core/`. Replace that private function with the shared helper; Repositories behaviour is unchanged. Leave `getNumberConfig` itself unchanged.

Unit specs: unset, `null`, `'abc'`, `'0'`, `'-5'`, `'1.5'` → fallback; `'7'` → 7. The existing `repositories-config.spec.ts` must still pass unchanged.

## Files to Change
- `backend/src/core/numeric-config.ts` — add `getPositiveIntConfig` with JSDoc.
- `backend/src/core/tests/numeric-config.spec.ts` — cases for the new helper.
- `backend/src/repositories/repositories-config.ts` — drop the private `positiveInteger`, use `getPositiveIntConfig`.
