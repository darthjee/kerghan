# 02 — Route and navbar link

- Register `['/repositories', 'repositories']` in `HashRouteResolver`'s `ROUTES` (before `'/'`).
- Map `'repositories'` to `<Repositories />` in `AppHelper`'s `PAGES`.
- In `HeaderHelper`'s logged-in branch, render `<Nav.Link href="#/repositories">Repositories</Nav.Link>` as a top-level link (not inside "My account"), shown to every logged-in user. It is hidden while `pending` because `renderAuthLinks` already returns `null` then.

## Files to Change
- `frontend/assets/js/utils/routing/HashRouteResolver.js` — new route.
- `frontend/assets/js/components/helpers/AppHelper.jsx` — new page entry.
- `frontend/assets/js/components/common/header/helpers/HeaderHelper.jsx` — the link.
- `frontend/specs/assets/js/utils/routing/HashRouteResolverSpec.js` — `#/repositories` resolves to `repositories`.
- `frontend/specs/assets/js/components/helpers/AppHelperSpec.js` — renders the page for the key.
- `frontend/specs/assets/js/components/common/header/helpers/HeaderHelperSpec.js` — the link shows for a logged-in user (admin or not) and is absent while pending and when logged out.
