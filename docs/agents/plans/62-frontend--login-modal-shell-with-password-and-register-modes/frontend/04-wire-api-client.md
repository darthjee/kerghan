# Wire ApiClient's session-expired handling to the modal

In `client/ApiClient.js`, change the private `#sessionExpired()` method so that, on an
unrecoverable `401`, it clears `AuthSession`, emits `auth:changed` `false` via `AuthEvents`
(unchanged), and calls `LoginModalEvents.open('password')` instead of setting
`window.location.hash = LOGIN_HASH`. Drop the now-unused `LOGIN_HASH` constant. Import
`LoginModalEvents` alongside the existing `AuthEvents` import.

Opening the modal here must not issue any API call — this is a pure client-side state
transition, so the risk to watch for is triggering `#sessionExpired` again from whatever reacts
to the modal opening (no request loop).

## Files to Change

- `frontend/assets/js/client/ApiClient.js` — `#sessionExpired` now opens the modal; drop
  `LOGIN_HASH`.
- `frontend/specs/assets/js/client/ApiClientSpec.js` — update the `#sessionExpired` spec(s) to
  assert `LoginModalEvents.open('password')` is called (and no hash navigation happens) instead
  of asserting on `window.location.hash`.
