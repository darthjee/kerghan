# Convert the admin markup specs to renderedOutput
Replace `renderToStaticMarkup` and the `html` variables with `renderedOutput` from `frontend/specs/support/renderedOutput.js`. Follow `LoginModalFormsHelperSpec`: a local builder (for example `renderPage(state, handlers = buildHandlers())`, wrapping in a `div` if needed) and boolean matchers.

**`AdminUsersHelperSpec.js`:** convert every case.
- `toContain(x)` becomes `expect(page.contains(x)).toBeTrue()`, and `not.toContain(x)` becomes `.toBeFalse()`. Add `withContext` when a case has more than one expectation.
- `toContain('href="#/admin/users/1/edit"')` becomes `containsAttribute('href', '#/admin/users/1/edit')`.
- `toContain('>Edit<')` becomes `containsElement('a', 'Edit')`.
- Assertions on `alert-danger` can stay as `contains('alert-danger')` (no markup in the literal) or use `containsAttribute('class', ...)` only when the full class value is known.
- Remove the `renderToStaticMarkup` import and add `React` only if the builder needs `React.createElement`.

**`AdminUsersSpec.js`:** in "passes the default state to the helper", replace `renderToStaticMarkup(...)` / `html` with `renderedOutput(React.createElement(AdminUsers))` and `expect(page.contains('admin-users')).toBeTrue()`. Leave the other cases, which use `renderCapturingHandlers`, unchanged.

## Files to Change
- `frontend/specs/assets/js/components/resources/admin/pages/helpers/AdminUsersHelperSpec.js` — switch to `renderedOutput` and boolean assertions.
- `frontend/specs/assets/js/components/resources/admin/pages/AdminUsersSpec.js` — switch the default-state case to `renderedOutput`.
