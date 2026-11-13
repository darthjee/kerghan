# Core: Clock and shared 502/503 helpers

## Clock

Add `backend/src/core/clock.ts`, which holds:
- an abstract `Clock` class (`now(): Date`), used as its own DI token;
- a `SystemClock` implementation that returns `new Date()`.

Provide it in Integrations as `{ provide: Clock, useClass: SystemClock }`. #463 will provide it the same way in Repositories, so no global module is needed. Every time rule added in this issue reads the `Clock`, never `Date.now()`. That covers:
- the installation-token "`expires_at` − 5 min" check;
- the budget tracker's "reset passed" check;
- the "now + `Retry-After`" fallback for `resetAt`.

Add `backend/src/core/tests/support/fake-clock.ts`, a test helper exposing `FakeClock` with `set(date)`, `advance(ms)` and `now()`.

## Shared 502/503 helpers (`integrations.md#shared-502--503-helpers`)

Move `githubUnavailable()` and `githubRateLimited(retryAfterSeconds?)` from `integrations/integration-http-errors.ts` to the new `backend/src/core/github-http-errors.ts`. Codes, messages, statuses and `retryAfterSeconds` stay byte-identical. `integration-http-errors.ts` imports them from `core/`, and `httpErrorFor` is unchanged. Update every importer. The behaviour does not change.

## Files to Change

- `backend/src/core/clock.ts`: new; `Clock` and `SystemClock`.
- `backend/src/core/tests/support/fake-clock.ts`: new; `FakeClock`.
- `backend/src/core/github-http-errors.ts`: new; the two helpers that move here.
- `backend/src/integrations/integration-http-errors.ts`: imports the helpers from `core/`.
- Every importer of the moved helpers, found with grep.
