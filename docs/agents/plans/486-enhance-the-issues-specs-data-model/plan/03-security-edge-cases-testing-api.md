# Update security.md, edge-cases.md, testing.md and api.md

- `security.md`: add bullets: no secret column in any table, markers carry no payload, the link's `user_id` is for uniqueness only (never authorization), private-repository issue content is stored unencrypted like Repositories' private metadata. Add two open questions owned by #490: retention of the issue content of soft-deleted projects (their `issues` rows stay in v1), and encryption at rest of issue content plus per-user quotas on projects and issues.
- `edge-cases.md`: add a line pointing at the model-level edge-case table in `model.md` (owned there) and narrow the open items that it partly answers ("An integration or a user deleted", "A restart with pending writes", "Concurrent edits on both sides" stay open for #493 except for the data-level rows now in `model.md`).
- `testing.md`: add one bullet that data-model tests run in the DB-backed tier (as Repositories) and that `model.md`'s required tests feed #494; keep #494's open questions.
- `api.md`: add one bullet that the title and body length caps (256 and 65536 characters) come from `model.md` and that the issues listing sort and its index are #489's decision.

## Files to Change

- `docs/agents/specs/issues/security.md` — bullets and two open questions.
- `docs/agents/specs/issues/edge-cases.md` — pointer to the model-level table, narrowed items.
- `docs/agents/specs/issues/testing.md` — DB-backed tier bullet.
- `docs/agents/specs/issues/api.md` — length caps and sort pointer.
