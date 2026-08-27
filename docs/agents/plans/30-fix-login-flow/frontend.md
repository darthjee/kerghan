# Frontend Plan: Fix login flow

Main plan: [plan.md](plan.md)

## Shared contracts

- Calls `backend`'s `DELETE /auth/logoff.json` (body `{ refreshToken }`, `204` response) for
  logout — see [plan.md](plan.md)'s "Shared contracts" for the full detail.
- Consumes `POST /auth/login.json` / `register.json` / `refresh.json`'s existing
  `{ user, refreshToken }` + `access_token`-cookie response shape, unchanged.
- Relies on the existing `401` behavior (expired access token on any request; expired/invalid
  refresh token on `refresh.json` itself) to drive reactive refresh and session-expired
  handling — no backend change needed for this to work.

## Steps

- [01 — Auth client and token storage](frontend/01-auth-client-and-token-storage.md)
- [02 — ApiClient reactive refresh and session expiry](frontend/02-api-client-reactive-refresh.md)
- [03 — Login page](frontend/03-login-page.md)
- [04 — Auth-aware Header](frontend/04-auth-aware-header.md)
- [05 — Frontend auth flow documentation](frontend/05-documentation.md)

## CI Checks

- `frontend`: `npm run coverage` (CI job: `jasmine`)
- `frontend`: `npm run lint` (CI job: `frontend-checks`)

## Notes

- No global state management (Redux/Context) exists in this codebase — auth state is derived
  synchronously from `localStorage` on each render, consistent with the app's existing
  no-context, static-helper style (`AppHelper`, `HeaderHelper`, etc.). Do not introduce a
  context provider for this.
- `Header.jsx`'s current docstring says auth-awareness is explicitly out of scope — that note is
  superseded by this issue (see [04](frontend/04-auth-aware-header.md)).
