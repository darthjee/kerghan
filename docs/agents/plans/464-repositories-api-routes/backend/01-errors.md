# Error codes, helpers and `retryAfterSeconds` in the body

This step adds the three new codes to `ErrorCodes`:

- `REPOSITORY_SOURCE_UNUSABLE`;
- `REPOSITORY_REFRESH_COOLDOWN`;
- `REPOSITORY_ADD_RATE_LIMITED`.

It also adds a module-local helper file, `repositories/repositories-http-errors.ts`, in the style of `integrations/integration-http-errors.ts`. Its helpers:

- `repositoryNotFound()`: `404 NOT_FOUND`, message `Repository not found`. It is the single source for every Add `404`, so the bodies are identical.
- `repositorySourceUnusable()`: `409`, message `The integration that sees this repository needs attention.`
- `refreshCooldown(retryAfterSeconds)`: `429`, message `Repositories were synced recently; try again later`.
- `addRateLimited(retryAfterSeconds)`: `429`, message `Too many repositories added; try again later`.

The `502`/`503` answers reuse `githubUnavailable()` / `githubRateLimited()` from `core/github-http-errors.ts`, and nothing is imported from `integrations/integration-http-errors.ts`.

Then the step changes `core/http-exception.filter.ts`. When a valid `retryAfterSeconds` is present, the body gets `error.retryAfterSeconds` (whole seconds, rounded up, the same value as the header). This is a new optional field of the standard error shape (`api.md#errors`). The filter's JSDoc and `ErrorPayload` type are updated to match.

## Files to Change

- `backend/src/core/error-codes.ts`: the three codes.
- `backend/src/repositories/repositories-http-errors.ts`: new, the helpers above.
- `backend/src/core/http-exception.filter.ts`: `retryAfterSeconds` in the error body, and the updated JSDoc.
- `backend/src/core/tests/http-exception.filter.spec.ts` (or wherever the filter is specced), plus any existing spec that asserted the field was absent: assert the header and the body field together.
- `backend/src/repositories/tests/repositories-http-errors.spec.ts`: the status, code and message of each helper, and that every `404` helper call produces an identical body.
