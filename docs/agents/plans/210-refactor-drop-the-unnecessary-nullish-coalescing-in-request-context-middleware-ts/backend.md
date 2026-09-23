# Backend Plan: Refactor: Drop the unnecessary nullish coalescing in request-context.middleware.ts

Main plan: [plan.md](plan.md)

## Overview
In `RequestContextMiddleware`, the access-log `path` is computed as `(req.originalUrl ?? req.url).split('?')[0]`. Express types `originalUrl` as a non-optional `string`, and `@nestjs/platform-express` always sets it at runtime, so the fallback is dead code. Remove it, together with the unit spec that only covers it.

## Context
- Codacy finding: `@typescript-eslint/no-unnecessary-condition` (High) at `backend/src/core/request-context.middleware.ts:45`.
- `backend/src/core/tests/request-context.middleware.spec.ts` has the spec `falls back to req.url when originalUrl is absent`, which passes a mock with only `url`. The other specs already use `originalUrl`, including `'/health.json?token=x'` for the query-string-stripping case.
- `backend/src/core/tests/request-logging.e2e-spec.ts` goes through real Express requests, so it needs no changes.

## Implementation Steps

### Step 1 — Drop the fallback in the middleware
In `use()`, change the logged `path` to `req.originalUrl.split('?')[0]`. No other behavior changes, and the JSDoc can stay as it is.

### Step 2 — Remove the fallback spec
Delete the `it('falls back to req.url when originalUrl is absent', ...)` block from `request-context.middleware.spec.ts`. Check that every remaining `Request` mock in the file sets `originalUrl`; if one does not, add the property to the mock rather than restoring the fallback. Coverage should not drop, because the removed spec only covered the deleted branch.

## Files to Change
- `backend/src/core/request-context.middleware.ts` — replace `(req.originalUrl ?? req.url)` with `req.originalUrl`.
- `backend/src/core/tests/request-context.middleware.spec.ts` — remove the fallback spec.

## CI Checks
- `backend`: `docker-compose run --rm kerghan_tests yarn lint` (CI job: `backend_checks`)
- `backend`: `docker-compose run --rm kerghan_tests yarn coverage` (CI job: `backend_tests`)

## Notes
- Do not add the `req.url` fallback back under any other form (e.g. `||`). The finding is about the branch being unreachable, not about the operator used.
