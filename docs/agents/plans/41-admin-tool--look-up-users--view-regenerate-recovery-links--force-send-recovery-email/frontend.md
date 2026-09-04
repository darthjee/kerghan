# Frontend Plan: Admin tool: look up users, view/regenerate recovery links, force-send recovery email

Main plan: [plan.md](plan.md)

## Shared contracts

- `/auth/login.json`, `/auth/register.json`, `/auth/refresh.json` responses' `user` object now
  carries `isAdmin: boolean`.
- `/auth/status.json` response is now `{ loggedIn: boolean, isAdmin: boolean }`.
- New backend endpoints to call, all requiring the caller to be an admin (a `403` means: hide the
  UI / redirect away, this should only be reachable via the gated nav link in the first place):
  - `POST /admin/users/search.json` (body `{ q }`, `q` optional) → `{ users: [{ id, username,
    email, isAdmin, createdAt }] }`
  - `POST /admin/users/:id/recovery-link.json` → `{ resetUrl: string }`
  - `POST /admin/users/:id/send-recovery-email.json` → `{ sent: boolean }`

## Steps

- [01 — Propagate isAdmin through the app's auth state](frontend/01-propagate-is-admin-auth-state.md)
- [02 — Add AdminClient](frontend/02-add-admin-client.md)
- [03 — Build the Admin Users page](frontend/03-build-admin-users-page.md)
- [04 — Wire routing and tests](frontend/04-wire-routing-and-tests.md)

## CI Checks

- `frontend/`: `docker-compose run --rm kerghan_fe yarn test` (CI job: `jasmine`)
- `frontend/`: `docker-compose run --rm kerghan_fe yarn lint` (CI job: `frontend-checks`)

## Notes

- There is no existing "protected route" concept in `HashRouteResolver` — real enforcement of who
  can use the admin page is the backend's `@AdminOnly()` guard (`403` on the API calls), not
  frontend routing. The frontend's job is just to not advertise the page to non-admins (hide the
  nav link) and to handle a `403` gracefully if the page is still reached directly by hash.
- This is the first "list/search" page in the frontend (every existing page is a form) and the
  first page under a new `resources/admin/` folder — follow the existing
  `resources/accounts/pages/` Page/Controller/Helper split, not a new pattern.
