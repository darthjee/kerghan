# Extract shared fetch/refresh helpers
Create a support module under `frontend/specs/support/` and move `fakeResponse` and `fetchSequence` into it verbatim (keeping their JSDoc and the `security/detect-object-injection` disable comment). Add:

- `stubRefreshFlow(responses, { refreshToken })` — installs the `AuthSession` spies (`get` returning the given refresh token, defaulting to `'old-refresh-token'`, and `null`-able for the "missing token" case; `set` and `clear` spied) and assigns `globalThis.fetch = fetchSequence(responses)`. The `'missing token'` test currently spies only `get` and `clear`, and the "failed refresh" test only `get` and `clear`; spying `set` as well is harmless because those flows never reach it, but verify no assertion relies on `set` being real.
- `expectSessionExpired()` — asserts `AuthSession.clear` was called, `LoginModalEvents.open` was called with `'password'`, and `globalThis.window.location.hash` is `''` (see the note in the main plan about where this lives).

Export them as named exports, following `fakeWindow.js`'s style.

## Files to Change
- `frontend/specs/support/fetchSequence.js` — new module exporting `fakeResponse` (if still needed outside), `fetchSequence`, `stubRefreshFlow` and, if it fits, `expectSessionExpired`.
- `frontend/specs/support/fetchSequenceSpec.js` — optional small spec for the new helpers, matching the `fakeWindowSpec.js` convention.
