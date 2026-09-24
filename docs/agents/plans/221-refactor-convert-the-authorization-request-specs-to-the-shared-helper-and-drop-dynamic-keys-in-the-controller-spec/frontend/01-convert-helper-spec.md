# Convert AuthorizationRequestsHelperSpec
Replace `renderToStaticMarkup` + `expect(html).toContain(...)` with the shared helper (19 `xss/no-mixed-html` findings).

- Drop the `react-dom/server` import; import `renderedOutput` from `../../../../../../../support/renderedOutput.js`.
- Add a local `renderPage = (state, handlers = buildHandlers()) => renderedOutput(AuthorizationRequestsHelper.render(state, handlers))`, as `AdminUsersHelperSpec` does.
- Map the assertions:
  - plain text / class names (`'Authorization Requests'`, `'network error'`, `'alert-danger'`, `'No pending authorization requests.'`, `'127.0.0.1'`, `'Mozilla/5.0'`, `'5 min ago'`, `'just now'`, `'Deny'`, `'Authorize'`, `'Confirm'`, `'Invalid password'`, `'text-danger'`) → `page.contains(...)` with `.toBeTrue()` / `.toBeFalse()`.
  - `toContain('type="password"')` → `page.containsAttribute('type', 'password')`.
  - `not.toContain('>Authorize<')` → `page.containsElement('button', 'Authorize')` is false (the Authorize toggle is `<button ...>Authorize</button>` in `AuthorizationRequestsHelper.jsx`).
- The two "wires the ... handlers" cases only need to render. Call `renderPage(state, handlers)` and keep the spy assertions unchanged.

## Files to Change
- `frontend/specs/assets/js/components/resources/accounts/pages/helpers/AuthorizationRequestsHelperSpec.js`: switch to `renderedOutput`.
