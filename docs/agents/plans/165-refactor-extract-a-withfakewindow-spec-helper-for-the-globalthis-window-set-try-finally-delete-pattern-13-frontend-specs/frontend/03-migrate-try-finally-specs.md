# Migrate the remaining try/finally specs
For each of these, replace `const fakeWindow = { ... }; globalThis.window = fakeWindow; try { ... } finally { delete globalThis.window; }` with `const fakeWindow = installFakeWindow({ ... })` and un-nest the body from the `try`. Add an `afterEach(() => { uninstallFakeWindow(); })` at the top-level `describe` (or the smallest enclosing `describe` that covers every test installing a fake). Where only some tests need `window`, keep the install call inside those tests. Preserve the existing assertions and any other cleanup in the `finally` blocks (check before removing).

- `AdminUsersControllerSpec.js` — 3 tests (`handleSearch`, `handleGenerateLink`, `handleSendEmail`).
- `RegisterControllerSpec.js` — 2 tests.
- `AdminUserEditControllerSpec.js` — 1 test; this spec also uses the shared `accountEditFormControllerExamples.js` context, so keep `afterEach` scoped correctly.
- `AdminUserEditSpec.js` — 1 test (fake hash `#/admin/users/42/edit`, wrapped around `renderToStaticMarkup`).

## Files to Change
- `frontend/specs/assets/js/components/resources/admin/pages/controllers/AdminUsersControllerSpec.js` — use the helper
- `frontend/specs/assets/js/components/resources/accounts/pages/controllers/RegisterControllerSpec.js` — use the helper
- `frontend/specs/assets/js/components/resources/admin/pages/controllers/AdminUserEditControllerSpec.js` — use the helper
- `frontend/specs/assets/js/components/resources/admin/pages/AdminUserEditSpec.js` — use the helper
