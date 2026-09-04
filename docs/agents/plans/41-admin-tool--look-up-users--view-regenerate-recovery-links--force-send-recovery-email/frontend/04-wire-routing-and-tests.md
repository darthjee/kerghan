# Wire routing and tests

Add the new page to the app's routing so `#/admin/users` renders it, and make sure the nav link
added in step 01 actually points somewhere real.

- `frontend/assets/js/components/helpers/AppHelper.jsx` — import `AdminUsers` and add an
  `'admin/users': <AdminUsers />` entry to the `PAGES` map (check `HashRouteResolver`'s key format
  first — the existing keys are flat like `'login'`/`'reset-password'`; confirm whether a
  slash-containing key like `'admin/users'` round-trips correctly through the resolver, or
  whether the existing convention wants a flat key like `'admin-users'` with the href
  `#/admin-users` instead — match whichever the resolver already supports rather than introducing
  a new key shape).
- Update `HeaderHelper.jsx`'s new admin nav link (from step 01) to point at whichever hash the
  chosen `PAGES` key resolves to.
- Run the full frontend suite and lint locally before considering this done — `docker-compose run
  --rm kerghan_fe yarn test` and `docker-compose run --rm kerghan_fe yarn lint` — since this step
  touches shared files (`AppHelper.jsx`, `HeaderHelper.jsx`) that every other step's changes also
  land in.

## Files to Change

- `frontend/assets/js/components/helpers/AppHelper.jsx` — register the new page.
- `frontend/assets/js/components/common/header/helpers/HeaderHelper.jsx` — point the nav link at
  the real route.
- `frontend/specs/assets/js/components/helpers/AppHelperSpec.js` (or wherever `AppHelper`'s spec
  lives) — cover the new page key.
