# Login page

Add a Login page, mirroring the existing Register page/controller/helper structure exactly
(`frontend/assets/js/components/resources/accounts/pages/`), plus wire it into the app's route
table.

- `frontend/assets/js/components/resources/accounts/pages/controllers/LoginController.js` —
  mirrors `RegisterController`: constructor takes `(setSubmitError, client = AccountsClient)`
  (no per-field validation errors needed — username/password are only checked server-side, there
  are no format rules to validate client-side like Register's email pattern); `handleSubmit`
  calls `this.client.login(fields)` and redirects home on success
  (`window.location.hash = '/'`), same guarded pattern as
  `RegisterController#redirectHome`.
- `frontend/assets/js/components/resources/accounts/pages/Login.jsx` — mirrors `Register.jsx`:
  local `username`/`password` field state, a memoized `LoginController`, delegates rendering to
  `LoginHelper`.
- `frontend/assets/js/components/resources/accounts/pages/helpers/LoginHelper.jsx` — mirrors
  `RegisterHelper`: a two-field form (`username` text, `password` password), submit-error alert,
  "Login" submit button.
- `frontend/assets/js/utils/routing/HashRouteResolver.js` — add `['/login', 'login']` to
  `ROUTES`, before the catch-all `['/', 'home']` entry.
- `frontend/assets/js/components/helpers/AppHelper.jsx` — import `Login` and add
  `login: <Login />` to `PAGES`.

## Files to Change

- `frontend/assets/js/components/resources/accounts/pages/controllers/LoginController.js` — new
- `frontend/assets/js/components/resources/accounts/pages/Login.jsx` — new
- `frontend/assets/js/components/resources/accounts/pages/helpers/LoginHelper.jsx` — new
- `frontend/assets/js/utils/routing/HashRouteResolver.js` — register `/login`
- `frontend/assets/js/components/helpers/AppHelper.jsx` — map `login` page key to `<Login />`
- `frontend/specs/assets/js/components/resources/accounts/pages/controllers/LoginControllerSpec.js` — new, mirroring `RegisterControllerSpec.js`
- `frontend/specs/assets/js/components/resources/accounts/pages/LoginSpec.js` — new, mirroring `RegisterSpec.js`
- `frontend/specs/assets/js/components/resources/accounts/pages/helpers/LoginHelperSpec.js` — new, mirroring `RegisterHelperSpec.js`
