# Frontend auth flow documentation

Document the frontend auth flow built in steps 01-04 — no such documentation exists yet.

- `docs/agents/architecture/frontend.md` — add a new "Auth flow" section: the `AccountsClient`
  methods and the routes they call (cross-reference `docs/agents/modules/auth.md` for the
  backend contract rather than duplicating it), `AuthSession`'s role (refresh token in
  `localStorage`; the access token itself is an httpOnly cookie the frontend never touches),
  `ApiClient`'s reactive 401-refresh-and-retry behavior and session-expired redirect, and
  `Header`'s Login/Logout nav. Also fix this doc's now-stale opening line ("no real components,
  client, or router exist yet") — Register, routing, and the client layer already exist before
  this issue even starts.

## Files to Change

- `docs/agents/architecture/frontend.md` — new "Auth flow" section; correct the stale
  "tooling-only skeleton" opening claim
