# Backend Plan: Define a standard API error response format and status-code mapping

Main plan: [plan.md](plan.md)

## Shared contracts

The backend **produces** the error body, category codes and specific codes defined in
[plan.md](plan.md#shared-contracts), for every error response — including `ValidationPipe`
failures, guard rejections and unexpected (non-HTTP) exceptions.

## Steps

- [01 — Add the global exception filter](backend/01-add-global-exception-filter.md)
- [02 — Remap status codes and attach specific codes](backend/02-remap-status-codes.md)
- [03 — Assert error bodies in e2e specs](backend/03-e2e-error-body-assertions.md)
- [04 — Document the error contract](backend/04-document-error-contract.md)

## CI Checks
- `backend`: `docker-compose run --rm kerghan_tests yarn coverage` (CI job: `backend_tests`)
- `backend`: `docker-compose run --rm kerghan_tests yarn lint` (CI job: `backend_checks`)

## Notes
- Register the filter via the `APP_FILTER` provider in `AppModule` (not `app.useGlobalFilters` in
  `main.ts`) so it gets `LoggerService` through DI and so the e2e test apps can register it the same
  way. `main.ts` then needs no change beyond its doc comment.
- Enumeration safety: responses that are deliberately identical today (e.g. `Invalid or expired
  token`, `Invalid username or password`, `Invalid or expired refresh token`, the authorization-request
  uniform failures) must keep the same status and message and get the same category code — do not
  attach distinguishing specific codes to them.
- `AccountService#applyGuardedChecks` counts any thrown error as a failed attempt; switching the
  "already in use" errors to `409` must not change that counting.
