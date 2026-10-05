# Backend Plan: Revoke other sessions on password change

Main plan: [plan.md](plan.md)

## Shared contracts

- Accept an optional `refreshToken?: string` on `UpdateAccountDto` (`PATCH /auth/account.json`).
- When a My Account password change succeeds, revoke every unrevoked refresh token of the
  caller except the presented one. Because the exclusion matches by hash within the caller's
  own rows, a missing, unknown, revoked, expired or foreign token excludes nothing, so all of
  the caller's tokens are revoked (fail safe).
- When an admin password edit succeeds (`AdminService#editUser` with `newPassword`), revoke all
  of the target user's unrevoked refresh tokens.
- Username/email-only changes revoke nothing. Response shapes are unchanged.

## Steps

- [01 — Add a user-token revocation method to TokenService](backend/01-token-service-revocation.md)
- [02 — Revoke on My Account password change](backend/02-account-password-change.md)
- [03 — Revoke on admin password edit](backend/03-admin-password-edit.md)
- [04 — Update docs](backend/04-docs.md)

## CI Checks
- `backend`: `docker-compose run --rm kerghan_tests yarn coverage` (CI job: `backend_tests`)
- `backend`: `docker-compose run --rm kerghan_tests yarn lint` (CI job: `backend_checks`)

## Notes
- `auth.service.ts` is at 298 lines (project convention: 300 per file), so the new logic must
  not go there. Put it in `TokenService`, which is at 161 lines and already owns the
  refresh-token repository and `hashToken`.
- Never revoke when only username/email change, even if `refreshToken` is sent.
- Controllers stay thin: `AuthController#updateAccount` keeps passing the DTO through unchanged.
- Check that `UserUpdateService#applyUserUpdate(user, dto)` ignores the extra `refreshToken`
  field. It only reads `username`/`email`/`newPassword`, so it does.
