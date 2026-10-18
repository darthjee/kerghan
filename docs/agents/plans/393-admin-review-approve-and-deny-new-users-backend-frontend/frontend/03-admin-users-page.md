# Page and helper: filter, status column, action buttons, confirmation

- `AdminUsers.jsx`: new `status` state (initial `''` = all) and `currentUserId` state; a filter
  change handler; submit and filter change both call `controller.handleSearch(query, status)`;
  `onApprove` / `onDeny` handlers like the existing per-row ones.
- `AdminUsersHelper.jsx`:
  - a status `<select>` next to the search box: All, Pending, Approved, Denied;
  - a **Status** column;
  - **Approve** button only when `user.status === 'pending'`;
  - **Deny** button unless `user.status === 'denied'` or `user.id === state.currentUserId`
    (still shown on the default user's row: its `409` message is displayed as a row error);
  - no approve / deny on a denied user.
- Specs (`ui.md` "Admin filter" / "Admin actions"): each filter value sends the matching
  `status` combined with `q`; approve only on pending; deny hidden on own row and on denied
  users; deny asks for confirmation; success updates the row; `422` / `409` messages shown.

## Files to Change

- `frontend/assets/js/components/resources/admin/pages/AdminUsers.jsx`
- `frontend/assets/js/components/resources/admin/pages/helpers/AdminUsersHelper.jsx`
- `frontend/specs/assets/js/components/resources/admin/pages/AdminUsersSpec.js`
- `frontend/specs/assets/js/components/resources/admin/pages/helpers/AdminUsersHelperSpec.js`
