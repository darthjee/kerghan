# Auth client and token storage

Fix `AccountsClient`'s broken registration URL and give it the rest of the auth surface (login,
refresh, logout), plus a small localStorage-backed helper for the refresh token so every caller
(this client, `ApiClient`'s retry logic in [step 02](02-api-client-reactive-refresh.md), and
`Header` in [step 04](04-auth-aware-header.md)) shares one place to read/write/clear it.

- `frontend/assets/js/client/AccountsClient.js` — fix `register`'s URL from
  `/accounts/register.json` to `/auth/register.json`; add `login({ username, password })` (POST
  `/auth/login.json`), `refresh(refreshToken)` (POST `/auth/refresh.json`), and
  `logout(refreshToken)` (DELETE `/auth/logoff.json`, per [plan.md](../plan.md)'s shared
  contract). `login`/`register`/`refresh` all persist the returned `refreshToken` via the new
  token-storage helper before resolving; `logout` clears it (even if the request itself fails —
  the client-side session should still end).
- `frontend/assets/js/client/ApiClient.js` — add a `deleteJson(path, body)` counterpart to
  `postJson` (same headers/`credentials: 'same-origin'`/error-handling shape, `method: 'DELETE'`
  with a JSON body — `fetch` supports a body on `DELETE`), for `AccountsClient.logout` to use.
- `frontend/assets/js/client/AuthSession.js` (new) — thin wrapper around a single
  `localStorage` key (e.g. `kerghan_refresh_token`) with `get()`, `set(token)`, `clear()`, and
  `isLoggedIn()` (`get() !== null`). No React/DOM dependency — a plain class with static
  methods, matching `ApiClient`'s style.

## Files to Change

- `frontend/assets/js/client/AccountsClient.js` — fix `register` URL; add `login`, `refresh`,
  `logout`
- `frontend/assets/js/client/ApiClient.js` — add `deleteJson`
- `frontend/assets/js/client/AuthSession.js` — new
- `frontend/specs/assets/js/client/AccountsClientSpec.js` — update for the fixed URL and new
  methods
- `frontend/specs/assets/js/client/ApiClientSpec.js` — add coverage for `deleteJson`
- `frontend/specs/assets/js/client/AuthSessionSpec.js` — new
