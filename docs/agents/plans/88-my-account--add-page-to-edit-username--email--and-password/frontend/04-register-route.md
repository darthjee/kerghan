# Register the new route

Add the new page to the hash-based router:
- `HashRouteResolver.js:10-15` — add `['/account/my-account', 'my-account']` to the `ROUTES`
  array, following the existing `path → key` pair shape.
- `AppHelper.jsx:9-16` — import `MyAccount` from its new file (step 03) and add
  `'my-account': <MyAccount />` to the `PAGES` key→component map, alongside the existing entry
  for `authorization-requests`.

## Files to Change
- `frontend/assets/js/.../HashRouteResolver.js` — add the new route entry.
- `frontend/assets/js/.../AppHelper.jsx` — import `MyAccount` and register it in `PAGES`.
