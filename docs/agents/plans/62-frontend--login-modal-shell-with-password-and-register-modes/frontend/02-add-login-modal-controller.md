# Add LoginModalController

Create `components/common/loginModal/controllers/LoginModalController.js`, responsible for
everything that isn't rendering:

- **Mode state**: which of `password` / `register` is active; a method to switch modes that
  resets all form fields (confirmed behavior: no carry-over between modes).
- **Per-mode submit**: a password-mode submit calling `AccountsClient.login`, and a
  register-mode submit calling `AccountsClient.register`, each producing a field-error map on
  failure (mirror today's `LoginController` / `RegisterController` error-state shape).
- **Shared success handler**: mirrors today's `LoginController.handleSubmit` success path —
  the refresh token is already persisted by the `AccountsClient` call, then
  `AuthEvents.emit(true, user.isAdmin)`, then `LoginModalEvents.close()`, then
  `window.location.hash = '/'`. Both modes converge on this one handler.
- **Register validation reuse**: reuse `RegisterController`'s `validate()` rather than
  duplicating it — either import and call the existing `RegisterController.validate()` as a
  static/pure method, or extract it to a small shared helper that both `RegisterController` and
  `LoginModalController` compose. Prefer the smallest change that avoids duplication; do not
  rewrite `RegisterController` beyond what's needed to expose `validate()` for reuse.

## Files to Change

- `frontend/assets/js/components/common/loginModal/controllers/LoginModalController.js` — new
  file.
- `frontend/assets/js/components/resources/accounts/pages/controllers/RegisterController.js` —
  only if `validate()` needs to be exposed/extracted differently for reuse; otherwise unchanged.
- `frontend/specs/assets/js/components/common/loginModal/controllers/LoginModalControllerSpec.js`
  — new spec: mode switching (and the field reset), each mode's submit (success and
  validation/API failure), and the shared success handler (asserts `AuthEvents.emit`,
  `LoginModalEvents.close`, and the hash navigation all happen once).
