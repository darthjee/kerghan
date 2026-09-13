# Frontend Plan: Admin: add page to edit a user's username, email, and password

Main plan: [plan.md](plan.md)

## Shared contracts

- Calls `POST admin/users/:id/edit.json` (`AdminUpdateUserDto` request, `{ user: { id, username,
  email, isAdmin, createdAt } }` response, `BadRequestException`/`NotFoundException` errors
  surfaced as `ApiError`) — see [plan.md](plan.md)'s "Shared contracts" for the exact shapes this
  page relies on the backend producing.

## Context

`AdminUsersHelper.jsx`'s `#renderRow` (`frontend/assets/js/components/resources/admin/pages/
helpers/`) is where "Generate link"/"Send email" live and where a new "Edit" link goes.
`HashRouteResolver.js`'s `ROUTES` table has no `:id`-parameterized route yet; `Router.js`/
`Route.js` already support `:id` segments (`Route.params`/`Router.extractParams`), just unused so
far — this page is the first consumer. `MyAccount.jsx`/`MyAccountController.js`/
`MyAccountHelper.jsx` (`frontend/assets/js/components/resources/accounts/pages/`, from #88) is the
closest existing pattern for the form itself, minus the `currentPassword` field and its validation.

## Steps

- [01 — Register the admin-user-edit route](frontend/01-register-route.md)
- [02 — Add the Edit link to the Admin Users table](frontend/02-add-edit-link.md)
- [03 — Build the AdminUserEdit page](frontend/03-build-edit-page.md)
- [04 — Tests](frontend/04-tests.md)

## CI Checks

- `frontend`: `docker-compose run kerghan_fe yarn coverage` (CI job: `jasmine`)
- `frontend`: `docker-compose run kerghan_fe yarn lint` (CI job: `frontend-checks`)

## Notes

- No state needs to be lifted/pushed back from the edit page into `AdminUsers.jsx`'s table:
  `AdminUsers` already resets its search results on every fresh mount/search, so navigating back
  after an edit and re-searching shows the backend's authoritative (already-updated) data — same
  as `MyAccount.jsx` never needing to inform any other page of its own updates.
- The `isAdmin` flag is not rendered as an editable field anywhere on this page.
