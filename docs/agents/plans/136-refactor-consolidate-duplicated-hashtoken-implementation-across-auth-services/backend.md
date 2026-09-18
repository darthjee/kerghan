# backend Plan: Refactor: consolidate duplicated hashToken implementation across auth services

Main plan: [plan.md](plan.md)

## Steps

- [01 — Add shared token-hash utility](backend/01-add-shared-token-hash-util.md)
- [02 — Delegate TokenService.hashToken to the shared util](backend/02-delegate-token-service-hashtoken.md)
- [03 — Update PasswordResetService](backend/03-update-password-reset-service.md)
- [04 — Update AuthorizationRequestService](backend/04-update-authorization-request-service.md)
- [05 — Add unit tests for the shared util](backend/05-add-token-hash-spec.md)

## CI Checks
- `backend`: `docker-compose run --rm kerghan_tests yarn test` (CI job: `coverage`)
- `backend`: `docker-compose run --rm kerghan_tests yarn lint` (CI job: `lint`)

## Notes
- Every existing call site must produce byte-identical output — the shared util is a pure extraction, not a behavior change.
- `TokenService.hashToken` stays public and delegates to the shared util (per the issue's resolved scope) so `AuthService`'s three call sites and its `auth.service.spec.ts` mock of `tokenService.hashToken` need no changes.
- `PasswordResetService` and `AuthorizationRequestService` drop their private `#hashToken` entirely and import the shared util directly, since nothing external calls those private methods.
- Out of scope: `backend/src/auth/tests/authorization-request.service.test-support.ts` has its own local `sha256()` test helper that independently reimplements the same one-liner to compute expected values for assertions. This is a legitimate independent check (asserting against the production code, not sharing an implementation with it) rather than a duplicate the issue asks to remove — leave it as-is unless a future issue says otherwise.
