# Build the Admin Users page

New folder `frontend/assets/js/components/resources/admin/pages/`, following the
`resources/accounts/pages/` Page/Controller/Helper split (`AdminUsers.jsx`,
`controllers/AdminUsersController.js`, `helpers/AdminUsersHelper.jsx`) — this is the first
list/search page in the app (every existing page is a form), so there's no prior list-page
pattern to match beyond the Page/Controller/Helper file split itself.

- **Controller** (`AdminUsersController.js`): holds the search query, the current results, and a
  per-user last-action result/error (e.g. "link generated", "email sent", "email failed").
  `handleSearch(q)` calls `AdminClient.searchUsers(q)` and stores `users`.
  `handleGenerateLink(userId)` calls `AdminClient.generateRecoveryLink(userId)` and stores the
  returned `resetUrl` against that user's row so the helper can render it (a plain link/text field
  the admin can copy — this app has no existing "copy to clipboard" component, so a selectable
  `<input readOnly>` or similar is enough, no new dependency). `handleSendEmail(userId)` calls
  `AdminClient.sendRecoveryEmail(userId)` and stores the boolean `sent` result against that row.
  A `403` from any call (`ApiError` with `status === 403`, matching `ApiError`'s shape) redirects
  home the same way `LoginController`/`HeaderController` redirect (`window.location.hash = '/'`)
  — this is the fallback for the page being reached directly by hash despite not being an admin.
- **Helper** (`AdminUsersHelper.jsx`): a search input + submit, and a table (react-bootstrap
  `Table`, already a project dependency via `react-bootstrap/cjs/...`) listing `id`, `username`,
  `email`, `isAdmin`, and, per row, a "Generate link" button, a "Send email" button, and whatever
  per-row result the controller is currently holding for that user.
- **Page** (`AdminUsers.jsx`): wires `useState`s to the controller, mirroring
  `Recover.jsx`/`ResetPassword.jsx`'s existing shape (controller instance held via `useMemo`,
  state passed to the helper's `render`).

## Files to Change

- `frontend/assets/js/components/resources/admin/pages/AdminUsers.jsx` — new file.
- `frontend/assets/js/components/resources/admin/pages/controllers/AdminUsersController.js` — new
  file.
- `frontend/assets/js/components/resources/admin/pages/helpers/AdminUsersHelper.jsx` — new file.
- matching specs under `frontend/specs/` (mirror wherever `Recover`/`RecoverController`'s specs
  live).
