# Route, menu item and page wiring
- Register `['/account/integrations', 'integrations']` in `HashRouteResolver`'s `ROUTES`, next to the other `/account/...` routes.
- Map `'integrations'` to the new `<Integrations />` page in `AppHelper.jsx`.
- Add `<NavDropdown.Item href="#/account/integrations">Integrations</NavDropdown.Item>` to `renderMyAccountDropdown` in `HeaderHelper.jsx`, next to *Authorizations* and *Account*.
- Logged-out behavior matches the other `#/account/...` pages: the load fires, and `ApiClient`'s 401 flow opens the login modal.

Specs: `HeaderHelperSpec` checks the item is shown when logged in (with the link) and hidden when logged out. Add a `HashRouteResolver` spec for the new route, and an `AppHelper` spec if one maps pages.

## Files to Change
- `frontend/assets/js/utils/routing/HashRouteResolver.js`: new route.
- `frontend/assets/js/components/helpers/AppHelper.jsx`: page mapping.
- `frontend/assets/js/components/common/header/helpers/HeaderHelper.jsx`: menu item.
- Matching specs under `frontend/specs/assets/js/...`.
