# Migrate the four page specs
- `accounts/pages/AuthorizationRequestsSpec.js`: replace the 4 capture blocks (deny, confirm-authorize, toggle, password) with `const handlers = renderCapturingHandlers(AuthorizationRequests, AuthorizationRequestsHelper);`; keep the controller `load`/`authorize`/`deny` spies and the fake `preventDefault` event in the tests.
- `admin/pages/AdminUsersSpec.js`: same for submit, generate-link, send-email tests.
- `admin/pages/AdminUserEditSpec.js`: same for the submit and change tests (keep `installFakeWindow` before the call and `afterEach(uninstallFakeWindow)`); replace the default-state test with `itBehavesLikeAnAccountEditPage(...)`.
- `accounts/pages/MyAccountSpec.js`: same for the submit and change tests; replace the default-state test with `itBehavesLikeAnAccountEditPage(...)`.

Keep every test name and every assertion unchanged, and preserve the ordering of `spyOn` calls relative to rendering. Drop imports that become unused (`React`, `renderToStaticMarkup`) only where no remaining test needs them — `AuthorizationRequestsSpec.js` still needs both for the default-state test. Relative import paths to `specs/support/` follow the existing pattern (see `AdminUserEditSpec.js`'s `fakeWindow.js` import).

## Files to Change
- `frontend/specs/assets/js/components/resources/accounts/pages/AuthorizationRequestsSpec.js` — use `renderCapturingHandlers`.
- `frontend/specs/assets/js/components/resources/admin/pages/AdminUsersSpec.js` — use `renderCapturingHandlers`.
- `frontend/specs/assets/js/components/resources/admin/pages/AdminUserEditSpec.js` — use `renderCapturingHandlers` and the shared default-state example.
- `frontend/specs/assets/js/components/resources/accounts/pages/MyAccountSpec.js` — use `renderCapturingHandlers` and the shared default-state example.
