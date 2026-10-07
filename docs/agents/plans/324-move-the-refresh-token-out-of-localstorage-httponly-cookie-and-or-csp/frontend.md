# Frontend Plan: Move the refresh token out of localStorage (httpOnly cookie and/or CSP)

Main plan: [plan.md](plan.md)

## Shared contracts

The frontend **relies on** the backend contract in [plan.md](plan.md#shared-contracts):

- The browser stores and sends `refresh_token` automatically (httpOnly, `Path=/auth`). The frontend never reads or sends it.
- `logged_in=1` (readable through `document.cookie`, `Path=/`) means "probably logged in"; `status.json` confirms. The backend clears it on logoff, on a failed refresh and on `status → loggedIn: false`.
- `login`/`register`/`refresh`/approved-`poll` responses carry `{ user }` (no `refreshToken`).
- No request body carries `refreshToken`. The one exception is the one-time migration call: `POST /auth/refresh.json` with `{ refreshToken: <legacy localStorage value> }`.
- Legacy `localStorage` key: `kerghan_refresh_token`.

## Steps

- [01 — Rework AuthSession](frontend/01-auth-session.md)
- [02 — Stop sending and receiving the token in clients](frontend/02-clients.md)
- [03 — Header and one-time migration wiring](frontend/03-header-and-migration.md)
- [04 — Specs and docs](frontend/04-specs-and-docs.md)

## CI Checks

- `frontend`: `docker-compose run --rm kerghan_fe yarn test` and `docker-compose run --rm kerghan_fe yarn lint` (CI workflow `test`)

## Notes

- `AccountsClient.js` is at 291 lines and `ApiClient.js` at 228 (300-line limit). Removing the token handling should shrink them; don't add new logic there that the cookie made unnecessary.
- `fetch` already uses `credentials: 'same-origin'`, so cookies flow without changes.
- Keep `AuthSession` SSR/spec-safe: `document` is undefined in Node Jasmine specs, so fall back the same way the current in-memory `localStorage` stub does.
