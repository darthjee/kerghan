# Update module and architecture docs

Document the new column, the token claim, the authorization primitive, and admin provisioning.

- `docs/agents/modules/auth.md`:
  - "Entities (`auth_` table prefix)" — add `isAdmin` (default `false`) to the `auth_users`
    field list.
  - Demo-user paragraph — note that a follow-on dev-only migration
    (`20260903120007-auth-promote-demo-user-admin.ts`, also `STAGE=production`-gated) promotes
    the seeded `demo` user to admin.
  - "JWT/refresh-token flow" — note the access-token payload now also carries `isAdmin`,
    (re)issued on every login/register/refresh, so a role change takes effect on the next
    refresh (and immediately for anything that re-logs in).
  - New short subsection (e.g. "Admin authorization"): `@AdminOnly()` + global `AdminGuard`
    (`core/`), runs after `JwtGuard`, 401 unauthenticated / 403 authenticated-non-admin, no-op
    without the decorator. State that `user` in route responses stays `{ id, username, email }`
    — `isAdmin` is not exposed over HTTP yet.
  - **First admin**: document the manual step —
    `UPDATE auth_users SET is_admin = true WHERE username = '<username>';` run directly against
    the database; there is no admin-provisioning endpoint or CLI.
- `docs/agents/architecture/backend.md` — "JWT Guard" section: add a sentence (or a sibling
  "Admin Guard" note) that a second global guard, `AdminGuard`, is registered after `JwtGuard`
  and enforces `@AdminOnly()` by reading the `isAdmin` claim from `request.user`.
- Check `docs/agents/backend/routes/auth.md` (referenced from `auth.md`) — if it enumerates the
  token payload / `user` response shape, keep it consistent (payload gains `isAdmin`; response
  `user` unchanged).

## Files to Change

- `docs/agents/modules/auth.md` — `isAdmin` field, demo-user promotion note, token-claim note,
  admin-authorization subsection, manual first-admin instructions.
- `docs/agents/architecture/backend.md` — note the global `AdminGuard` alongside `JwtGuard`.
- `docs/agents/backend/routes/auth.md` — align token-payload / response-shape mentions if present.
