# Migrate the originalWindow save/restore specs
In each spec, delete the `let originalWindow;` declaration, the `originalWindow = globalThis.window;` line and the `globalThis.window = originalWindow;` restore. Replace the fake assignment in `beforeEach` with `installFakeWindow(<same fake>)` and make `afterEach` call `uninstallFakeWindow()` (keeping any other cleanup there, e.g. `ApiClientSpec.js` also restores `globalThis.fetch`).

- `ResetPasswordLandingSpec.js` — one test re-assigns `globalThis.window` mid-test; switch it to a second `installFakeWindow(...)` call (the helper keeps the true original).
- `ModalRedirectSpec.js`, `LoginModalControllerSpec.js`, `ApiClientSpec.js` — `{ location: { hash } }` fakes.
- `useLoginModalSpec.js`, `useAuthEffectSpec.js`, `LoginModalEventsSpec.js`, `AuthEventsSpec.js` — `new EventTarget()` fakes; keep their explanatory comments about Node having no DOM.
- Assertions reading `globalThis.window.location.hash` may stay as-is, or use the fake returned by `installFakeWindow` — pick whichever is the smaller diff per file.

Note `AuthEventsSpec.js` / `LoginModalEventsSpec.js` also contain unrelated `try/finally` blocks that unsubscribe handlers; leave those untouched.

## Files to Change
- `frontend/specs/assets/js/components/resources/accounts/pages/ResetPasswordLandingSpec.js` — use the helper
- `frontend/specs/assets/js/components/common/ModalRedirectSpec.js` — use the helper
- `frontend/specs/assets/js/components/common/loginModal/hooks/useLoginModalSpec.js` — use the helper
- `frontend/specs/assets/js/components/common/loginModal/controllers/LoginModalControllerSpec.js` — use the helper
- `frontend/specs/assets/js/components/common/header/hooks/useAuthEffectSpec.js` — use the helper
- `frontend/specs/assets/js/client/LoginModalEventsSpec.js` — use the helper
- `frontend/specs/assets/js/client/AuthEventsSpec.js` — use the helper
- `frontend/specs/assets/js/client/ApiClientSpec.js` — use the helper
