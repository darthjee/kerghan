# AdminClient: status filter, approve, deny

- `searchUsers(q, status)`: send `pickDefined({ q, status })` (omit `status` for "all"); update
  the JSDoc return type with `status` on each user and `currentUserId`.
- `approveUser(userId)` → `postJson('/admin/users/${userId}/approve.json', {})`.
- `denyUser(userId)` → `postJson('/admin/users/${userId}/deny.json', {})`.
- Add `status` to the `editUser` JSDoc user shape.
- Specs: request path and body for each, `status` omitted when undefined.

## Files to Change

- `frontend/assets/js/client/AdminClient.js` — new methods, `status` param.
- `frontend/specs/assets/js/client/AdminClientSpec.js` — specs (create if absent, following
  sibling client specs).
