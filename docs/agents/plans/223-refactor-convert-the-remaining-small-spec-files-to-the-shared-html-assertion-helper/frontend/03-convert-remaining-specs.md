# Convert MyAccountHelperSpec, LoginModalSpec and AppSpec
- **MyAccountHelperSpec.js**: replace `page.contains('id="my-account-currentPassword"')` with `page.containsAttribute('id', 'my-account-currentPassword')` and keep its `.withContext(...)`. Leave `contains('Current password')` as it is (plain text, not markup). `page` already comes from the shared examples' `renderPage`, which returns a `renderedOutput`.
- **LoginModalSpec.js**: replace the `renderToStaticMarkup` import with `import { renderedOutput } from '../../../../../support/renderedOutput.js';`. Make `render()` return `renderedOutput(React.createElement(LoginModal))`. In the first case, rename `html` to `page` and assert `expect(page.contains('login-modal')).withContext('helper output').toBeTrue()`. The other cases ignore the return value and need no change.
- **AppSpec.js**: replace the `renderToStaticMarkup` import with `import { renderedOutput } from '../../support/renderedOutput.js';`. In both cases, build `const page = renderedOutput(React.createElement(App));`:
  - `toContain('Kerghan')` → `expect(page.contains('Kerghan')).withContext('header').toBeTrue()`
  - `not.toContain('<h1>Register</h1>')` → `expect(page.containsElement('h1', 'Register')).withContext('register heading').toBeFalse()`

Check each relative import path against the file's actual depth before committing.

## Files to Change
- `frontend/specs/assets/js/components/resources/accounts/pages/helpers/MyAccountHelperSpec.js`: switch to `containsAttribute`.
- `frontend/specs/assets/js/components/common/loginModal/LoginModalSpec.js`: switch to `renderedOutput`.
- `frontend/specs/assets/js/AppSpec.js`: switch to `renderedOutput`.
