# ApiClient reactive refresh and session expiry

Make `ApiClient` transparently recover from an expired access token by refreshing it once and
retrying, and cleanly end the session when the refresh token itself is no longer valid.

- `frontend/assets/js/client/ApiClient.js` — when `postJson`/`deleteJson` receive a `401`:
  1. If this request has already been retried once, skip straight to step 3 (session-expired
     handling) — do not refresh/retry again (avoids an infinite loop if the retried request also
     comes back `401`).
  2. Otherwise, read the stored refresh token via `AuthSession` (from
     [step 01](01-auth-client-and-token-storage.md)). If present, call
     `POST /auth/refresh.json` directly (a plain internal `postJson` call, not through
     `AccountsClient`, to avoid a circular import — `AccountsClient` already imports
     `ApiClient`). On success, persist the new `refreshToken` via `AuthSession.set` and retry the
     original request exactly once with the now-refreshed `access_token` cookie.
  3. If there is no stored refresh token, or the refresh call itself comes back `401`
     (refresh token invalid/expired/already revoked), treat it as a session-expired condition:
     clear `AuthSession`, then redirect to the Login route (`window.location.hash = '/login'`,
     guarded the same way `RegisterController#redirectHome` guards `window` for SSR/spec
     environments) instead of resolving/rejecting the original call normally.
- Keep the existing non-401 error path (`ApiError` with `response.status`/`data.error`)
  unchanged for every other status code.

## Files to Change

- `frontend/assets/js/client/ApiClient.js` — 401-retry-with-refresh and session-expiry handling
- `frontend/specs/assets/js/client/ApiClientSpec.js` — cover: successful refresh-then-retry,
  refresh itself failing (session-expired redirect + `AuthSession` cleared), no stored refresh
  token on a `401` (session-expired redirect without attempting a refresh call), and a
  second `401` on the retried request not looping into another refresh attempt
