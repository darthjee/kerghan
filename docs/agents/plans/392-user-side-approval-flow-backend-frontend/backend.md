# Backend Plan: User-side approval flow (backend + frontend)

Main plan: [plan.md](plan.md)

## Shared contracts

Produces everything in [plan.md](plan.md#shared-contracts): the `UserStatus` values, the flag, the
`status.json` table (including **not** clearing cookies for `pending`), `403 USER_DENIED` on
login, and unchanged register / logoff responses. Also adds `ErrorCodes.USER_DENIED` and
`RevokedReason.ADMIN_DENIED = 'admin_denied'` (#393 reuses both).

## Steps

- [01 — Status column, entity and migration](backend/01-status-column-and-migration.md)
- [02 — Approval flag and registration status](backend/02-flag-and-registration.md)
- [03 — Gate rule 3: require `approved`](backend/03-gate-requires-approved.md)
- [04 — Login, status and refresh](backend/04-login-status-refresh.md)
- [05 — Recover and reset](backend/05-recover-reset.md)
- [06 — Device-authorization poll](backend/06-device-authorization-poll.md)
- [07 — Default user and seeds](backend/07-default-user-and-seeds.md)
- [08 — Environment-variable docs](backend/08-env-var-docs.md)

## CI Checks

- `backend`: `docker-compose run --rm kerghan_tests npm run lint` and `npm run coverage`
  (CI jobs: `yarn_project` with `script: lint` / `script: coverage`, `dir: backend`). Never run
  `npm`/`yarn` on the host; use the project's `docker-compose` service.

## Notes

- Every status rule lives in the services (`AuthService`, `PasswordResetService`,
  `AuthorizationRequestService`, `DefaultUserService`, `SessionService`); the only controller
  change is `status.json`'s cookie handling, which reads a flag returned by the service.
- Unit / e2e specs use in-memory repositories (`tests/support/in-memory-repo.ts`) with no DB
  constraint, so a NOT NULL column without a default won't fail them on its own. Update every
  fixture that creates a `User` (e.g. `tests/support/auth-requests.ts`,
  `tests/support/default-user-e2e.ts`, specs that build users directly) to set `status`
  explicitly, and make the in-memory session lookup honor the status filter.
- Non-disclosure: every gate rejection must reuse `JwtGuard`'s `INVALID_TOKEN_MESSAGE`; the
  `denied` branches of `status.json` / `refresh.json` / `recover.json` / `reset-password.json`
  must be indistinguishable from their anonymous / invalid-token counterparts.
