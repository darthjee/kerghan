# Convert the "renders nothing" specs
In the `component` → `renders nothing` case of both specs:

- Remove the `renderToStaticMarkup` import. Import `renderedOutput` from the support folder (`../../../../../../support/renderedOutput.js` for `ResetPasswordLandingSpec.js`, `../../../../support/renderedOutput.js` for `ModalRedirectSpec.js`, the same depth as the `fakeWindow.js` imports they already use).
- Drop the wrapper `<div>`. Render the component directly:
  - `renderedOutput(React.createElement(ResetPasswordLanding))`
  - `renderedOutput(React.createElement(ModalRedirect, { mode: 'password' }))`
- Replace `expect(markup).toBe('<div></div>')` with `expect(page.isEmpty()).withContext('rendered output').toBeTrue()`.
- Keep the `React` import (still needed for `createElement`) and leave every other case unchanged.

## Files to Change
- `frontend/specs/assets/js/components/resources/accounts/pages/ResetPasswordLandingSpec.js`: use `renderedOutput(...).isEmpty()`.
- `frontend/specs/assets/js/components/common/ModalRedirectSpec.js`: use `renderedOutput(...).isEmpty()`.
