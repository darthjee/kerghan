# api.md

Create `docs/agents/specs/repos/api.md` — the HTTP surface of the Repositories module.

Decided (name, don't shape):

- Routes by method + purpose: **listing** (GET, paginated, filter All / Added / Not added / Unavailable, name search, served from the DB, includes sync state), **sync state** (GET, polled by the frontend), **refresh** (POST, forces a sync, cooldown), **add** (POST with a GitHub repository id; re-checked with GitHub; sets `added_at` and `integration_id`).
- Every route: `JwtGuard`, `.json` suffix convention, cache class `never` / `X-Skip-Cache` (user-scoped, never warmed by Navi), state-changing routes are POST (covered by `OriginGuard`).
- Access: another user's repository, or a repo the user cannot see, answers `404` like a missing one; admins have no access.
- Responses never include a credential or anything derived from it.
- Controllers stay thin; logic lives in the module's service (CLAUDE.md boundary).

Open markers (all #446): paths, request/response shapes, pagination format, filter/search parameters, status and error codes (incl. duplicate add, validation, `429` + `Retry-After`), polling contract.

End with **Required tests** for the decided rules (auth required, `X-Skip-Cache` on every route, user scoping / `404`, no admin access, POST for state changes, no credential in any response).

## Files to Change
- `docs/agents/specs/repos/api.md` — new.
