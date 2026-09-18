# Backend Plan: Refactor: extract shared numeric-config getter helper for abuse-guard services

Main plan: [plan.md](plan.md)

## Implementation Steps

### Step 1 — Add the shared `getNumberConfig` helper
Create `backend/src/core/numeric-config.ts` exporting:

```ts
getNumberConfig(configService: ConfigService, key: string, fallback: number): number
```

It reads `configService.get(key)`, parses it with `Number(...)`, and returns `fallback` whenever the raw value is `undefined`/`null` or the parsed result is `NaN`. Add `backend/src/core/tests/numeric-config.spec.ts` covering: value present and numeric, value absent (falls back), and value present but non-numeric (falls back, verifying the NaN guard — this is the one behavior change called out in the issue's Expected Behavior).

### Step 2 — Wire both abuse-guard services to the helper
In `backend/src/auth/account-edit-abuse-guard.service.ts`, replace `#maxAttempts()` and `#lockMs()` with calls to `getNumberConfig(this.configService, 'KERGHAN_ACCOUNT_EDIT_MAX_ATTEMPTS', DEFAULT_ACCOUNT_EDIT_MAX_ATTEMPTS)` and `getNumberConfig(this.configService, 'KERGHAN_ACCOUNT_EDIT_LOCK_MS', DEFAULT_ACCOUNT_EDIT_LOCK_MS)` respectively, keeping the private method wrappers (so call sites like `#nextAttemptState` don't change) and the existing `DEFAULT_*` constants/env-var keys unchanged.

In `backend/src/auth/authorization-request-abuse-guard.service.ts`, do the same for all five getters (`#createLimit`, `#createWindowMs`, `#maxOpenPerUser`, `#authorizeMaxAttempts`, `#authorizeLockMs`), each delegating to `getNumberConfig` with its own existing key/default.

Update the existing specs `backend/src/auth/tests/account-edit-abuse-guard.service.spec.ts` and `backend/src/auth/tests/authorization-request-abuse-guard.service.spec.ts` only if they assert on the removed private getters directly rather than through public behavior — otherwise no spec changes should be needed there, since resolved values for valid env vars are unchanged.

## Files to Change
- `backend/src/core/numeric-config.ts` — new shared `getNumberConfig` helper (new file)
- `backend/src/core/tests/numeric-config.spec.ts` — unit tests for the helper (new file)
- `backend/src/auth/account-edit-abuse-guard.service.ts` — `#maxAttempts`/`#lockMs` delegate to `getNumberConfig`
- `backend/src/auth/authorization-request-abuse-guard.service.ts` — all five numeric getters delegate to `getNumberConfig`
- `backend/src/auth/tests/account-edit-abuse-guard.service.spec.ts` — update only if it depended on removed internals
- `backend/src/auth/tests/authorization-request-abuse-guard.service.spec.ts` — update only if it depended on removed internals

## CI Checks
- `backend/`: `docker-compose run kerghan_tests yarn coverage` and `docker-compose run kerghan_tests yarn lint` (CI jobs: `backend_tests`, `backend_checks`)

## Notes
- Per the discuss-issue dialogue: the helper adds NaN protection (falls back to `fallback` when `Number(value)` is `NaN`) — a deliberate, small behavior change for malformed env vars, while every currently-valid numeric env var resolves identically to today.
- Each guard service keeps its own `DEFAULT_*` constants and env-var key strings; only the parsing/fallback logic is centralized.
