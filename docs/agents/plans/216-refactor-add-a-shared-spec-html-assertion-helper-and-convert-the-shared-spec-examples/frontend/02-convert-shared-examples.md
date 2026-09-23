# Convert the shared examples and their callers
**`accountEditFormHelperExamples.js`**
- Replace the internal `renderHtml` with `renderPage(state, handlers)`, which returns `renderedOutput(Helper.render(state, handlers))`.
- Rewrite every `expect(html).toContain(x)` / `.not.toContain(x)` as `expect(page.contains(x)).withContext(...).toBeTrue()` / `.toBeFalse()`, keeping the same expectations one-for-one.
- Rename the local `html` variables to `page` (or similar).
- Update the JSDoc (`@param renderHtml`, `@returns`) to describe `renderPage`.
- Return `{ buildHandlers, buildState, renderPage }` instead of `renderHtml`.

**`accountEditPageExamples.js`**
- Replace `const html = renderToStaticMarkup(React.createElement(Page))` with `renderedOutput(React.createElement(Page))`.
- Assert `contains(label)` in the same way.
- Drop the now-unused `renderToStaticMarkup` import.

**Callers**
- `MyAccountHelperSpec.js`: destructure `renderPage`. Convert the two `contains` assertions (`'Current password'`, `'id="my-account-currentPassword"'`). The side-effect-only call used for the change-handler spec becomes `renderPage(...)`.
- `AdminUserEditHelperSpec.js`: destructure `renderPage` and convert the single `not.toContain('Current password')`.

Run `yarn lint` and `yarn coverage` in `kerghan_fe`. The spec count must match the count before the change (plus the new helper spec), and all specs must pass.

## Files to Change
- `frontend/specs/support/accountEditFormHelperExamples.js`: use the helper and return `renderPage` instead of `renderHtml`.
- `frontend/specs/support/accountEditPageExamples.js`: use the helper.
- `frontend/specs/assets/js/components/resources/accounts/pages/helpers/MyAccountHelperSpec.js`: consume `renderPage`.
- `frontend/specs/assets/js/components/resources/admin/pages/helpers/AdminUserEditHelperSpec.js`: consume `renderPage`.
