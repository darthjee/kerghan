# New modules/auth/default-user.md

Create the permanent module doc for the feature, laid out like
`modules/integrations/pat.md`. Start with a header such as "Part of the
[Auth module](../auth.md). Code: `backend/src/auth/default-user.*`". Sections:

- **Overview**: what the default user and automatic login are, and that the feature is aimed at
  standalone (from the spec `README.md`).
- **Configuration**: `DefaultUserConfig` (from `configuration.md`). Link to
  `environment-variables.md` for the variable list rather than copying it.
- **Boot sync**: create or synchronize, password handling, collisions and races, the disabled
  flag (from `boot-sync.md`).
- **Edit blocking**: what is blocked, how the default user is identified, the per-field rule,
  the order of checks for `AccountService.updateAccount` and `AdminService.editUser`, password
  recovery and reset, edge cases, compatibility, future write paths (from `edit-blocking.md`
  and `boot-sync.md`). Include the `409` body shape or link to the route docs. Add a short "Why
  `409`" note.
- **Automatic login**: how it fits the JWT/refresh flow, the boot warning, turning it off. Link
  to `backend/routes/auth.md` for the wire contract. Add a short "Why only `status.json`" note
  covering the rejected guard bypass and the `JwtGuard` session flooding.
- **Security**: IP allowlist (including why it keeps the full private-range list), production
  guard, session flooding, credentials, admin access, standalone exposure (link to
  `standalone.md`), sessions that stay valid after the feature is turned off (from `security.md`).
- **Out of scope**: frontend indicator or hidden logout, more than one default user, removing the
  user when the flag is turned off, the demo-user seed, turning it on in production deployments.
- **Testing**: list the backend spec files and the standalone bats files (see `plan.md` Context).
  No "Required tests" lists.

In `modules/auth.md`:

- Add a short "Default user" section linking to the new file.
- In "Admin tool routes", note that `POST /admin/users/:id/edit.json` returns `409` for managed
  fields of the default user, with a link to the new file.

## Files to Change
- `docs/agents/modules/auth/default-user.md` — new file.
- `docs/agents/modules/auth.md` — "Default user" pointer section and admin-route `409` note.
