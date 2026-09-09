# Routing and page registration

Wire the new hash route to a `'authorization-requests'` page key, and register that key against
the (not-yet-created — see step 03) `AuthorizationRequests` page component.

Route ordering matters in `HashRouteResolver`'s `ROUTES` table: routes are matched top-to-bottom,
so add the new entry alongside the other specific paths (`/recover-password`, `/admin/users`),
before the catch-all `['/', 'home']` entry.

## Files to Change

- `frontend/assets/js/utils/routing/HashRouteResolver.js` — add
  `['/account/authorization-requests', 'authorization-requests']` to `ROUTES`, before
  `['/', 'home']`.
- `frontend/specs/assets/js/utils/routing/HashRouteResolverSpec.js` — add a case asserting
  `#/account/authorization-requests` resolves to `'authorization-requests'`.
- `frontend/assets/js/components/helpers/AppHelper.jsx` — import the new
  `AuthorizationRequests` component (from step 03) and add
  `'authorization-requests': <AuthorizationRequests />` to the `PAGES` map.
- `frontend/specs/assets/js/components/helpers/AppHelperSpec.js` — add a case asserting the
  `'authorization-requests'` key renders `AuthorizationRequests` (mirror the existing
  `'admin-users'` case).
