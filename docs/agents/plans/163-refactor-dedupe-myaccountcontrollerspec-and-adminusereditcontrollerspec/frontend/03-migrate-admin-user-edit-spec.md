# Migrate AdminUserEditControllerSpec

Rewrite `AdminUserEditControllerSpec.js` to call the shared example group with the Admin options (`AdminUserEditController`, `'editUser'`, base blank fields, `wrapResponse` = `(account) => ({ user: account })`, `submit` = `controller.handleSubmit(1, fields)`, expected call `[1, payload]`), and delete the spy setup and every case now covered by it (this also removes the 7-line self-clone at lines 110-116 / 157-163).

Keep only the Admin-specific cases, reusing the context/spies the shared module provides:

- `#handleSubmit`: passes the target `userId` through to `client.editUser` (only if the shared group's expected-args adapter does not already assert it); redirects home (`window.location.hash = '/'`) without setting a submit error on a `403`, including the `globalThis.window` fake/cleanup in a `try/finally` exactly as today.

## Files to Change
- `frontend/specs/assets/js/components/resources/admin/pages/controllers/AdminUserEditControllerSpec.js` — replace the duplicated cases and setup with the shared example group; keep the Admin-only cases above.
