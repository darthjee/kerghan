# Frontend Plan: User-side approval flow (backend + frontend)

Main plan: [plan.md](plan.md)

## Shared contracts

Relies on [plan.md](plan.md#shared-contracts): `status.json` answers
`{ loggedIn: false, isAdmin: false, status: "pending" }` for a pending user (cookies kept, so the
`logged_in` hint cookie stays), `{ loggedIn: true, isAdmin }` when approved, plain
`{ loggedIn: false, isAdmin: false }` otherwise; `login.json` answers `403` with
`error.code === 'USER_DENIED'` (surfaced as `ApiError.code`) for a denied user; register / login
response shapes unchanged; `DELETE /auth/logoff.json` works for a pending user.

## Steps

- [01 — Pending on the auth bus](frontend/01-pending-auth-state.md)
- [02 — Re-check status after register and login](frontend/02-recheck-after-register-login.md)
- [03 — Awaiting-approval view](frontend/03-awaiting-approval-view.md)
- [04 — Denied login message](frontend/04-denied-login-message.md)

## CI Checks

- `frontend`: `docker-compose run --rm kerghan_fe npm run lint` and `npm run coverage` (CI jobs:
  `yarn_project` with `script: lint` / `script: coverage`, `dir: frontend`). Never run on the host.

## Notes

- No timer polling anywhere: the re-check runs only on window focus and "Check again".
- Nothing in the UI may say an account was denied, except the login modal's `USER_DENIED`
  message.
