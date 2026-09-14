# backend Plan: Backend: brute-force lockout protection for PATCH /auth/account.json

Main plan: [plan.md](plan.md)

## Steps

- [01 — Create the `auth_account_edit_lockouts` table and entity](backend/01-create-lockout-table-and-entity.md)
- [02 — Add `AccountEditAbuseGuardService`](backend/02-add-account-edit-abuse-guard-service.md)
- [03 — Wire the guard into `AccountService`/`AuthModule`](backend/03-wire-guard-into-account-service.md)
- [04 — Document the new table and env vars](backend/04-document-table-and-env-vars.md)
- [05 — Tests](backend/05-tests.md)

## CI Checks

- `backend`: `npm run coverage` (CI job: `backend_tests`)
- `backend`: `npm run lint` (CI job: `backend_checks`)

## Notes

- Mirrors `AuthorizationRequestAbuseGuardService`'s cool-off pattern
  (`backend/src/auth/authorization-request-abuse-guard.service.ts`) but as its own
  service/table/config keys — that service's repository is hardcoded to
  `Repository<AuthorizationRequest>` and isn't reusable as-is.
- Per the issue's clarified scope: the counter increments on *any* failed validation on this
  endpoint (wrong `currentPassword`, duplicate `username`, duplicate `email`) — not just password
  mismatches — and a locked-out call gets a distinct `423 Locked` response rather than the generic
  wrong-password message, since the caller is already authenticated as this exact user (no
  enumeration risk).
- Once implemented, this change touches authentication/authorization logic on an existing
  endpoint — worth a pass from the `security` and `data-access` read-only reviewer agents before
  merging (per their descriptions in `.claude/agents/`), in addition to normal backend review.
