# Update edge-cases.md, testing.md, security.md, ui.md and issues.md

**edge-cases.md**

- Rows E3, E4, E46, E57 to E64 name their route and code from the `api.md` catalogue; the E18 recovery path names the `retry-sync.json` route. Ids stay stable; the outcomes do not change.
- Any open question owned by #489 is closed.
- The test-tier list: "E18 recovery paths (retry sync route) once #489 fixes it" becomes a plain item.

**testing.md**

- The route access matrix lists every Issues route (the 17 of `api.md`), with the uuid `400` and the issue-of-another-project `404`.
- Mention the `datetime(3)` same-second attach case and the code-point length case where the fixtures or tiers list them.

**security.md**

- Add: path ids are uuids, and responses never expose internal ids, `user_id` or integration fields; `error.meta` carries no internal ids, GitHub content or credentials; the not-found order (project, then issue) never reveals a foreign project's issues.

**ui.md**

- Add the inputs for #491 without deciding wording: the attach `409` is the warning; `ISSUE_NOT_LINKED` is treated as already unlinked; `alreadyFresh` on T2; a retry refused while the repository is Unavailable; issues listing filters (state, title search).

**issues.md**

- The index row for `api.md` reads decided.

## Files to Change

- `docs/agents/specs/issues/edge-cases.md` — codes on the link rows, E18 route.
- `docs/agents/specs/issues/testing.md` — route access matrix.
- `docs/agents/specs/issues/security.md` — identifier and `meta` rules.
- `docs/agents/specs/issues/ui.md` — inputs for #491.
- `docs/agents/specs/issues.md` — index status.
