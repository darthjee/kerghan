# Wire route and menu entry
- `HashRouteResolver`: add `['/account/sessions', 'sessions']` next to the other `/account/*` routes.
- `AppHelper`: import `Sessions` and map the `'sessions'` page key to `<Sessions />`.
- `HeaderHelper`: add `<NavDropdown.Item href="#/account/sessions">Sessions</NavDropdown.Item>` to the "My account" dropdown, after Integrations and before Account.

Specs: extend `HashRouteResolverSpec.js` (resolves `sessions`), `AppHelperSpec.js` (renders the Sessions page for the `sessions` key) and `HeaderHelperSpec.js` (dropdown contains `href="#/account/sessions"`).

## Files to Change
- `frontend/assets/js/utils/routing/HashRouteResolver.js` — new route.
- `frontend/assets/js/components/helpers/AppHelper.jsx` — map page key to component.
- `frontend/assets/js/components/common/header/helpers/HeaderHelper.jsx` — menu entry.
- `frontend/specs/assets/js/utils/routing/HashRouteResolverSpec.js` — route spec.
- `frontend/specs/assets/js/components/helpers/AppHelperSpec.js` — page mapping spec.
- `frontend/specs/assets/js/components/common/header/helpers/HeaderHelperSpec.js` — menu spec.
