# Frontend Plan: Admin review: approve and deny new users (backend + frontend)

Main plan: [plan.md](plan.md)

## Shared contracts

Consumes the routes in [plan.md](plan.md#shared-contracts):

- `searchUsers` → `POST /admin/users/search.json` with `{ q, status }`, answers
  `{ users: [{ id, username, email, isAdmin, createdAt, status }], currentUserId }`.
- `approveUser(id)` → `POST /admin/users/:id/approve.json`, answers `{ user }`.
- `denyUser(id)` → `POST /admin/users/:id/deny.json`, answers `{ user }`.
- Errors to display through `error.message`: `422 USER_NOT_PENDING`, `422 CANNOT_DENY_SELF`,
  `409 DEFAULT_USER_MANAGED`. A `403` keeps redirecting home (`redirectIfForbidden`).

## Steps

- [01 — AdminClient: status filter, approve, deny](frontend/01-admin-client.md)
- [02 — AdminUsersController: filter state and actions](frontend/02-admin-users-controller.md)
- [03 — Page and helper: filter, status column, action buttons, confirmation](frontend/03-admin-users-page.md)

## CI Checks

- `frontend/`: `docker-compose run kerghan_fe yarn coverage` and
  `docker-compose run kerghan_fe yarn lint` (CI jobs: `jasmine`, `frontend-checks`)

## Notes

- The filter opens on **"all"** (decided in the issue), which is today's behavior.
- The review tools are always shown, whatever `KERGHAN_USER_APPROVAL_REQUIRED` says.
- Confirmation for deny: follow the existing confirm pattern if the codebase has one (check the
  Sessions / integrations pages); otherwise `window.confirm`, injected so specs can stub it.
