# Issue: Refactor: Drop the unnecessary nullish coalescing in request-context.middleware.ts

## Description
The access-log line emitted by `RequestContextMiddleware` computes its `path` field as `(req.originalUrl ?? req.url).split('?')[0]` (`backend/src/core/request-context.middleware.ts:45`).

## Problem
Codacy reports `@typescript-eslint/no-unnecessary-condition` (High) at `backend/src/core/request-context.middleware.ts:45`: Express types `originalUrl` as a non-optional `string`, so the `?? req.url` fallback cannot be reached according to the types.

The fallback also cannot happen at runtime. The backend runs on `@nestjs/platform-express`, and Express always sets `req.originalUrl` before middleware runs. The only place the fallback is exercised is a spec that builds an incomplete request mock: `falls back to req.url when originalUrl is absent` in `backend/src/core/tests/request-context.middleware.spec.ts`.

## Expected Behavior
- For real Express requests, the logged `path` does not change: it is still `originalUrl` with the query string removed.
- The lint finding is gone, and the middleware has no dead branch left.

## Solution
- In `request-context.middleware.ts`, replace the expression with `req.originalUrl.split('?')[0]`.
- In `request-context.middleware.spec.ts`, remove the `falls back to req.url when originalUrl is absent` spec, because the behavior it covers no longer exists. Keep the other specs, which already build mocks with `originalUrl`, including the query-string-stripping case. If any remaining mock lacks `originalUrl`, add the property to the mock rather than restoring the fallback.
- No changes are expected in `request-logging.e2e-spec.ts`, since it goes through real Express requests.

## Benefits
Removes one High Codacy finding and a dead branch, together with the spec that only existed to cover that branch.

## Verification

- `docker-compose run --rm kerghan_tests yarn lint` and `docker-compose run --rm kerghan_tests yarn coverage` pass, with coverage not reduced.
- After merge, Codacy's re-analysis of `main` no longer reports the finding listed under **Problem**.

---
Source: Codacy static analysis of `main` (grade B, 538 open issues at the time of filing).
