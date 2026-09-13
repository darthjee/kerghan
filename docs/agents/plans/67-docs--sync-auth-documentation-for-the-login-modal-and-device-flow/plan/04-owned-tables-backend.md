# Add an Owned tables section to architecture/backend.md

`docs/agents/architecture/backend.md` has no per-module table-ownership listing today — the
generic prefixing *rule* lives in `docs/agents/architecture/modular-pattern.md` ("Each module
owns its tables under a distinct prefix"), but nothing in `backend.md` enumerates the actual
tables per module. Add a small new section for this (place it after "## Layout", before "##
Build", since it's a structural fact about the codebase like the layout tree above it).

Content: one row per module currently owning tables (today: only Auth — Mail has no entities per
`docs/agents/architecture/backend.md`'s own Layout comment "no HTTP surface" and
`docs/agents/modules/mail.md`).

| Table | Module | Notes |
|---|---|---|
| `auth_users` | Auth | |
| `auth_refresh_tokens` | Auth | |
| `auth_sessions` | Auth | |
| `auth_authorization_requests` | Auth | `user_id` is a logical FK (no physical FK, no cross-module JOIN) — `NULL` when the request's username didn't resolve to a real user |

Keep the table minimal — this section's job is discoverability (which module owns which table),
not a re-description of each entity's columns; that detail already lives in
`docs/agents/modules/auth.md`'s "Entities" section, which this new section should link to instead
of duplicating.

## Files to Change

- `docs/agents/architecture/backend.md` — new "## Owned tables" section (or similar heading)
  after "## Layout", listing all four `auth_`-prefixed tables with the `auth_authorization_requests`
  row noting the logical FK, linking to `docs/agents/modules/auth.md` for column-level detail.
