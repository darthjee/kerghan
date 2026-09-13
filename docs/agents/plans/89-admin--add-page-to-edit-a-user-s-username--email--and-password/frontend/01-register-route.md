# Register the admin-user-edit route

Add a new entry to `HashRouteResolver.js`'s `ROUTES` table:

```js
['/admin/users/:id/edit', 'admin-user-edit'],
```

Placed before the existing `['/admin/users', 'admin-users']` entry (specific-before-generic,
matching this file's stated route-ordering convention), even though the two patterns' regexes
don't actually overlap here.

Add the new page to `AppHelper.jsx`'s `PAGES` map:

```js
'admin-user-edit': <AdminUserEdit />,
```

The new `AdminUserEdit` component (built in step 03) reads the `:id` param itself via
`Router.extractParams('/admin/users/:id/edit', window.location.hash)` — the same static helper
`Route`/`Router` already expose, just not yet used by any page.

## Files to Change

- `frontend/assets/js/utils/routing/HashRouteResolver.js` — add the new route entry.
- `frontend/assets/js/components/helpers/AppHelper.jsx` — import `AdminUserEdit` and add it to
  `PAGES`.
