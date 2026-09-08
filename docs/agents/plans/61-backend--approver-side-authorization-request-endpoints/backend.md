# Backend Plan: Backend: approver-side authorization-request endpoints

Main plan: [plan.md](plan.md)

## Steps

- [01 — DTO and events](backend/01-dto-and-events.md)
- [02 — Service methods: listOpenForUser, authorize, deny](backend/02-service-methods.md)
- [03 — Controller routes](backend/03-controller-routes.md)
- [04 — Tests](backend/04-tests.md)

## CI Checks

- `backend/`: `docker-compose run --rm kerghan_tests yarn coverage` and
  `docker-compose run --rm kerghan_tests yarn lint` (CI jobs: `backend_tests`, `backend_checks`).

## Notes

- These are the first authenticated, non-admin routes in the codebase: no `@Public()`, no
  `@AdminOnly()`, just the global `JwtGuard` populating `request.user` (`{ sub, username,
  isAdmin }`, see `backend/src/core/access-token-payload.ts`). Read the approver's id from
  `req.user!.sub`, following `AuthorizationRequestController`'s existing `@Req() req: Request`
  pattern (there is no `@CurrentUser()` decorator in this codebase).
- `authorize` and `deny` must throw the *same* `BadRequestException` (same message) for every
  failure branch — missing row, wrong owner, wrong status, expired (authorize only), wrong
  password — never `401`/`403`, so `ApiClient`'s refresh-and-retry logic on the frontend isn't
  triggered by a business rejection.
- Per the issue's "What needs to be done", `deny` only asserts ownership + `status === 'open'`
  (no expiry check) — do not add an expiry check to `deny` that the issue doesn't ask for.
- `authorize` re-verifies the *approver's own* current password
  (`bcrypt.compare(password, approver.passwordDigest)`, mirroring `AuthService#validateCredentials`
  in `backend/src/auth/auth.service.ts`) — not the requesting device's password, and not the
  target account being logged into (they're the same account, but the check is against the
  approver row fetched fresh from `userRepository`, not the JWT payload).
- Reuse `SKIP_CACHE_HEADER` already imported in `authorization-request.controller.ts` from
  `./auth-response.js` — do not redeclare a local constant the way `admin.controller.ts` does.
