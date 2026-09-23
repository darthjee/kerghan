# Convert LoginModalFormsHelperSpec.js
Convert `frontend/specs/assets/js/components/common/loginModal/helpers/LoginModalFormsHelperSpec.js` to `renderedOutput`, keeping every case and making each assertion just as strict.

1. Drop the `renderToStaticMarkup` import and import `renderedOutput` from the support folder. Follow the relative path depth the caller specs converted in #216 use, e.g. `MyAccountHelperSpec.js`.
2. Replace the local `markup` helper with a non-html-named one, e.g.:
   ```js
   const renderForms = (state, handlers = buildHandlers()) => renderedOutput(
     React.createElement('div', null, LoginModalFormsHelper.render(state, handlers)),
   );
   ```
   Rename every `const html = markup(...)` to e.g. `const forms = renderForms(...)`. No identifier may contain `html` or `markup`, and that includes the `waitingState` case.
3. Map the assertions one for one:
   - `toContain('>X</button>')` → `expect(forms.containsElement('button', 'X')).withContext(...).toBeTrue()`, and the `not.` form → `.toBeFalse()`. Labels: Password, Register, Recover, Authorize with logged device, Send request, Log in, Back to log in, Try again.
   - `toContain('<form')` / `not.toContain('<form')` → `containsTag('form')` with `.toBeTrue()` / `.toBeFalse()`.
   - Every other `toContain(x)` / `not.toContain(x)` (ids, class names, copy, countdown) → `contains(x)` with `.toBeTrue()` / `.toBeFalse()`. Literals such as `'id="login-modal-username"'`, `'alert-danger'` and `'btn btn-outline-primary active'` contain no `<tag`, so they are safe.
   - Inline cases such as `expect(markup(buildState())).toContain('>Log in</button>')` become `expect(renderForms(buildState()).containsElement('button', 'Log in')).toBeTrue()`.
   - Add `withContext(...)` to cases with several assertions, following `frontend/specs/support/accountEditFormHelperExamples.js`.
4. Optionally make cases table-driven where they only differ by the expected fragment, e.g. the four mode-selector labels, or the per-mode field-set cases. Follow the existing device-panel `forEach` pattern. Don't merge cases in a way that changes what each one asserts.
5. Leave the React-tree click cases (`onSelectMode` via `tree.props.children`) unchanged.

## Files to Change
- `frontend/specs/assets/js/components/common/loginModal/helpers/LoginModalFormsHelperSpec.js`: switch to `renderedOutput` and remove every `<tag` literal and html/markup-named identifier.
