# Tests

Follow the existing spec layout under `frontend/specs/assets/js/components/resources/`, mirroring
`accounts/pages/{MyAccountSpec.js, controllers/MyAccountControllerSpec.js,
helpers/MyAccountHelperSpec.js}` for the new admin page, plus:

- `admin/pages/AdminUserEditSpec.js` — render, field changes, submit.
- `admin/pages/controllers/AdminUserEditControllerSpec.js` — validation (email format, password
  length, confirmation match, at least one field present), successful submit reflecting
  `result.user.username`/`email` back into the form, each error case (duplicate username/email,
  password too short) setting the right inline error, and the `403`-redirects-home path.
- `admin/pages/helpers/AdminUserEditHelperSpec.js` — rendered markup/fields/error placement.
- Extend `AdminUsersHelperSpec.js` to cover the new "Edit" link's `href`.
- Extend `AdminClientSpec.js` (if it exists; otherwise add one alongside the existing client specs)
  for the new `editUser` method.
- Extend `HashRouteResolverSpec.js`/`Router`-related specs (wherever the existing route table is
  tested) to cover the new `/admin/users/:id/edit` → `admin-user-edit` resolution.

## Files to Change

- `frontend/specs/assets/js/components/resources/admin/pages/AdminUserEditSpec.js`
- `frontend/specs/assets/js/components/resources/admin/pages/controllers/AdminUserEditControllerSpec.js`
- `frontend/specs/assets/js/components/resources/admin/pages/helpers/AdminUserEditHelperSpec.js`
- `frontend/specs/assets/js/components/resources/admin/pages/helpers/AdminUsersHelperSpec.js`
- Client and route-resolver specs covering `AdminClient.editUser` and the new route entry
  (exact file paths depend on where those existing specs already live).
