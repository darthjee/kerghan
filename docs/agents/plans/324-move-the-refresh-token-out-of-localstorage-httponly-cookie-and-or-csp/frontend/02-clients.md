# Stop sending and receiving the token in clients

- `AccountsClient`: delete `currentTokenBody()`. `register`/`login`/`refresh`/`pollAuthorizationRequest` no longer persist `result.refreshToken`. `refresh()`/`logout()`/`status()` take no token argument and send `{}`. The sessions methods (`mine`, `revoke`, `revokeOthers`) and the account update send no `refreshToken`. Add `migrateLegacyToken(token)`, which posts `{ refreshToken: token }` to `/auth/refresh.json` through the raw path, without the `401`-retry loop, and swallows a failure (resolving `false`).
- `ApiClient`: `handleUnauthorized` no longer reads a stored token. On a `401` it calls `POST /auth/refresh.json` with `{}` (the cookie rides along) when `AuthSession.isLoggedIn()` is true, and goes straight to `sessionExpired()` otherwise. A successful refresh retries the request once, as today, with no token to persist. `sessionExpired()` no longer clears storage, because the backend already cleared the cookies on the failed refresh.
- `HeaderController`: `logout()` calls `client.logout()` without a token. `checkStatus()` skips the call when `!AuthSession.isLoggedIn()`, otherwise calls `client.status()` and emits the result (no client-side clearing needed).
- `AdminClient`: update the JSDoc mention of `AuthSession` only if it becomes inaccurate.

## Files to Change
- `frontend/assets/js/client/AccountsClient.js` — drop token bodies and persistence; add `migrateLegacyToken`
- `frontend/assets/js/client/ApiClient.js` — cookie-based refresh on `401`
- `frontend/assets/js/components/common/header/controllers/HeaderController.js` — tokenless `logout`/`status`
