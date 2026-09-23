# Convert LoginModalHelper
In `LoginModalHelper.jsx`:

- Turn `TITLES` into a `Map` (`new Map([['password', 'Log in'], ...])`).
- Replace `static #title(mode)` with a non-exported module-level function `title(mode)` returning `TITLES.get(mode) ?? TITLES.get('password')`, keeping its JSDoc.
- Replace `export default class LoginModalHelper { static render(...) }` with `const LoginModalHelper = { render(state, handlers) { ... } }; export default LoginModalHelper;`, keeping the method's JSDoc. `render` calls `title(state.mode)` and still calls `LoginModalFormsHelper.render(state, handlers)` through the imported object so the `LoginModalHelperSpec` spy intercepts it.
- Remove the `eslint-disable-next-line @typescript-eslint/no-extraneous-class` comment block, and change the class JSDoc from "Follows the same static-class-with-`#render*`-methods convention…" to describe the object-module shape (plain object with module-level private render functions).

## Files to Change
- `frontend/assets/js/components/common/loginModal/helpers/LoginModalHelper.jsx` — Map lookup, object-literal export, suppression and JSDoc cleanup.
