# Issue: Refactor: Convert the remaining small spec files to the shared HTML-assertion helper

## Description
Five smaller frontend specs still render with `renderToStaticMarkup` directly and/or assert against HTML-literal strings, instead of using the shared `renderedOutput(...)` helper from `frontend/specs/support/renderedOutput.js` (added in #216).

## Problem
Codacy reports `xss/no-mixed-html` (High), 8 findings in total:

- `frontend/specs/assets/js/components/resources/accounts/pages/helpers/MyAccountHelperSpec.js` — 3
- `frontend/specs/assets/js/components/common/loginModal/LoginModalSpec.js` — 2
- `frontend/specs/assets/js/components/resources/accounts/pages/ResetPasswordLandingSpec.js` — 1
- `frontend/specs/assets/js/components/common/ModalRedirectSpec.js` — 1
- `frontend/specs/assets/js/AppSpec.js` — 1

The dependency (#216) is merged. The counts were taken before it: `MyAccountHelperSpec.js` has since moved mostly onto the shared examples, and the only markup literal left there is `contains('id="my-account-currentPassword"')`.

What each file still does:
- **MyAccountHelperSpec.js**: `page.contains('id="my-account-currentPassword"')`, an attribute passed as a markup string.
- **LoginModalSpec.js**: its `render` helper returns the raw `renderToStaticMarkup` string, and the first case checks `toContain('login-modal')` on it.
- **ResetPasswordLandingSpec.js** / **ModalRedirectSpec.js**: "renders nothing" cases wrap the component in a `<div>` and check `toBe('<div></div>')`.
- **AppSpec.js**: raw `renderToStaticMarkup` + `toContain('Kerghan')` and `not.toContain('<h1>Register</h1>')`.

## Expected Behavior
- Same test cases, checking the same behavior, all passing.
- No `renderToStaticMarkup` import and no HTML-literal strings left in any of the five specs.
- The files follow the same style as the specs already converted (#219–#222), e.g. `FormFieldsHelperSpec.js` and `AccountEditFormHelperSpec.js`.

## Solution
Spec-only change (the five specs plus the shared spec helper), owned by the `frontend` agent. No production code changes.

- **MyAccountHelperSpec.js**: `contains('id="my-account-currentPassword"')` → `containsAttribute('id', 'my-account-currentPassword')`.
- **LoginModalSpec.js**: `render` returns `renderedOutput(React.createElement(LoginModal))`. The first case asserts `html.contains('login-modal')` with `.withContext(...)`.
- **AppSpec.js**: render through `renderedOutput(React.createElement(App))`. `toContain('Kerghan')` → `contains('Kerghan')`. `not.toContain('<h1>Register</h1>')` → `containsElement('h1', 'Register')` is false.
- **`frontend/specs/support/renderedOutput.js`**: add `isEmpty()`, which returns `true` when the rendered output is the empty string. Document it in the function's JSDoc (description and `@returns`) next to the existing queries. This changes only the shared spec helper.
- **ResetPasswordLandingSpec.js** / **ModalRedirectSpec.js** ("renders nothing"): drop the `<div>` wrapper. Render the component directly through `renderedOutput(React.createElement(ResetPasswordLanding))` / `renderedOutput(React.createElement(ModalRedirect, { mode: 'password' }))`, and assert `page.isEmpty()` is true with `.withContext(...)`.

## Benefits
Removes the last 8 spec `xss/no-mixed-html` findings, so the shared-helper approach covers the whole spec tree.

## Verification

- `docker-compose run --rm kerghan_fe yarn lint` and `docker-compose run --rm kerghan_fe yarn coverage` pass, with coverage not reduced.
- After merge, Codacy's re-analysis of `main` no longer reports the findings listed under **Problem**.

---
Source: Codacy static analysis of `main` (grade B, 538 open issues at the time of filing).
