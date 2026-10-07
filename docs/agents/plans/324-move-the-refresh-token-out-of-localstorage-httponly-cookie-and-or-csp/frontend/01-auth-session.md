# Rework AuthSession

Turn `AuthSession` from token storage into a login-state hint reader plus the legacy-token migration helper.

- `isLoggedIn()`: `true` when `document.cookie` contains `logged_in=1`. Use an injectable or stubbable cookie source for specs (an in-memory fallback when `document` is undefined, matching the existing SSR-safe pattern).
- Remove `get()`/`set()`/`clear()` for the token. Add `clear()` only if a client-side "logged out" signal is still needed. The backend clears the cookies, so a plain no-op is not useful. Prefer removing it and updating callers.
- Add `takeLegacyToken()`: returns the `localStorage` `kerghan_refresh_token` value (or `null`) **and removes the key**, so the migration runs at most once whatever its outcome.

## Files to Change
- `frontend/assets/js/client/AuthSession.js` — hint-cookie reader plus `takeLegacyToken`
