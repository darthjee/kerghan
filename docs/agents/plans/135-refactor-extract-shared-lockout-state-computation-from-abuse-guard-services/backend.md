# Backend Plan: Refactor: extract shared lockout-state computation from abuse-guard services

Main plan: [plan.md](plan.md)

## Steps

- [01 — Add computeLockoutState helper](backend/01-add-lockout-state-helper.md)
- [02 — Refactor AccountEditAbuseGuardService](backend/02-refactor-account-edit-abuse-guard.md)
- [03 — Refactor AuthorizationRequestAbuseGuardService](backend/03-refactor-authorization-request-abuse-guard.md)

## CI Checks

- `backend/`: `docker-compose run kerghan_tests yarn coverage` and
  `docker-compose run kerghan_tests yarn lint` (CI jobs: `backend_tests`, `backend_checks`)

## Notes

- The arithmetic is already confirmed identical between the two services (same `>=` tie-break at
  `maxAttempts`, same `Date.now()` clock source) — this is a pure mechanical extraction, not a
  behavior change. Existing specs in `src/auth/tests/account-edit-abuse-guard.service.spec.ts` and
  `src/auth/tests/authorization-request-abuse-guard.service.spec.ts` assert this behaviorally and
  must keep passing unchanged after the refactor.
- Both services already resolve `maxAttempts`/`lockMs` independently via `getNumberConfig` in
  `src/core/numeric-config.ts` — the new helper takes plain numbers, no `ConfigService` dependency.
