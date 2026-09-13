# Build the AdminUserEdit page

Mirror `MyAccount.jsx`/`MyAccountController.js`/`MyAccountHelper.jsx`
(`frontend/assets/js/components/resources/accounts/pages/`) closely, with these differences:

- No `currentPassword` field anywhere (form, controller validation, or request payload).
- The target user's id comes from the route param (`Router.extractParams('/admin/users/:id/edit',
  window.location.hash).id`), not the logged-in session.
- Fields: `username`, `email`, `newPassword`, `newPasswordConfirmation` (client-side-only
  match-check, same as `MyAccountController#validate`/`#validateNewPassword` — never sent to the
  backend).
- Submits via a new `AdminClient.editUser(userId, payload)`:

  ```js
  static async editUser(userId, { username, email, newPassword }) {
    return ApiClient.postJson(`/admin/users/${userId}/edit.json`, {
      ...(username !== undefined && { username }),
      ...(email !== undefined && { email }),
      ...(newPassword !== undefined && { newPassword }),
    });
  }
  ```

- On success, reads `result.user.username`/`result.user.email` back into the form (the response is
  `{ user: {...} }`, unlike `AccountsClient.updateAccount`'s flatter `{username, email}` — adjust
  `#applySuccess`'s destructuring accordingly) and clears the password fields, same as
  `MyAccountController#applySuccess`.
- Reuses `AdminUsersController`'s `#redirectIfForbidden`/`#redirectHome` pattern for a `403` (not
  an admin) rather than `MyAccountController`'s plain error-message approach, since this page is
  admin-only like `AdminUsers`, not self-service.

New files, following the existing three-file split (`Page.jsx` / `controllers/PageController.js` /
`helpers/PageHelper.jsx`):

- `frontend/assets/js/components/resources/admin/pages/AdminUserEdit.jsx`
- `frontend/assets/js/components/resources/admin/pages/controllers/AdminUserEditController.js`
- `frontend/assets/js/components/resources/admin/pages/helpers/AdminUserEditHelper.jsx`

## Files to Change

- `frontend/assets/js/client/AdminClient.js` — add `editUser`.
- `frontend/assets/js/components/resources/admin/pages/AdminUserEdit.jsx` — new file.
- `frontend/assets/js/components/resources/admin/pages/controllers/AdminUserEditController.js` —
  new file.
- `frontend/assets/js/components/resources/admin/pages/helpers/AdminUserEditHelper.jsx` — new
  file.
