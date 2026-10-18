# AdminUsersController: filter state and actions

- `handleSearch(q, status)`: pass `status` to the client; store `users` and `currentUserId`
  (new setter, e.g. `setCurrentUserId`).
- `handleApprove(userId)` and `handleDeny(userId)`: call the client; on success replace that
  user in the list with the returned `user` (functional `setUsers`), so the row shows the new
  status and its buttons update; on error store `{ error: error.message }` as the row result via
  the existing `#handleRowError` (keeps the `403` redirect).
- `handleDeny` asks for confirmation first (injected confirm function, default
  `window.confirm`); a cancel does nothing.
- Specs: status forwarded to search; `currentUserId` stored; approve / deny success replace the
  row; `422` / `409` messages stored per row; `403` redirects; cancelled confirm skips the
  request.

## Files to Change

- `frontend/assets/js/components/resources/admin/pages/controllers/AdminUsersController.js`
- `frontend/specs/assets/js/components/resources/admin/pages/controllers/AdminUsersControllerSpec.js`
