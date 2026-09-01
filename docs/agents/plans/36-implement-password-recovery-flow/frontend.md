# Frontend Plan: Implement password recovery flow

Main plan: [plan.md](plan.md)

## Shared contracts

- `AccountsClient.recover(email)` → `POST /auth/recover.json { email }`. Always resolves
  (never surfaces a distinguishable error) — the calling controller must treat any outcome,
  including a thrown error, as "show the generic confirmation."
- `AccountsClient.resetPassword({ token, password, passwordConfirmation })` → `POST
  /auth/reset-password.json { token, password, password_confirmation }`. Resolves `{ reset:
  true }` on success; throws an `ApiError` (status `400`, `never 401`) on any rejection reason.
  Render `error.message` as-is in the submit-error alert — no special-casing needed for the
  known #42 message-wording caveat (see `plan.md`).
- Recovery link route: `#/recover-password?token=<token>` — path segment and query key must
  match `backend`'s `resetUrl` construction exactly (see `plan.md`).

## Steps

- [01 — Client methods and routing](frontend/01-client-and-routing.md)
- [02 — Recover page](frontend/02-recover-page.md)
- [03 — Reset-password page](frontend/03-reset-password-page.md)

## CI Checks

- `frontend`: `npm run coverage` (CI job: `jasmine`) and `npm run lint` (CI job:
  `frontend-checks`) — both run with `frontend/` copied to the job root (see
  `.circleci/config.yml`'s `Set folder` step), so run them the same way locally: `cd frontend &&
  npm run coverage` / `npm run lint`.

## Notes

- Neither new page is guarded against already-logged-in access, consistent with `Login`/
  `Register` today.
- `AccountsClient.recover`/`resetPassword` must not touch `AuthSession` — unlike
  `login`/`register`/`refresh`, these two flows never issue a refresh token.
