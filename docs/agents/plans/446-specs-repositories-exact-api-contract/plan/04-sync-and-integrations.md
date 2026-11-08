# sync.md and integrations.md knock-ons

- `sync.md#trigger`: the stale trigger is the listing `POST /repositories/mine.json`; the
  Refresh cooldown runs from the start of the last sync, whatever triggered it; Refresh while
  syncing returns the running sync (link `api.md#refresh`).
- `sync.md#execution`: the frontend polls `POST /repositories/sync/state.json`; extend #447's
  open marker with "must guarantee a sync stuck in `syncing` (e.g. after a restart) eventually
  returns to `idle`, or polling never ends".
- `sync.md#partial-failures` / per source: name the per-source status values as the API exposes
  them (`ok`, `error`, `invalid_credentials`, `rate_limited`, `page_cap_reached`, plus `pending`
  for a source not yet synced) — consistent with `model.md#sync-state` (adjust model.md's
  wording only if needed to list `pending`).
- `integrations.md`: extend #448's exported-service marker with two notes: whether Add tries
  the next candidate integration after a `401` on the first (with none left Add answers `404`),
  and where the shared `502 GITHUB_UNAVAILABLE` / `503 GITHUB_RATE_LIMITED` helpers live
  (exported by Integrations vs moved to `core/`).

## Files to Change
- `docs/agents/specs/repos/sync.md` — trigger, cooldown rule, polling route, #447 marker note.
- `docs/agents/specs/repos/integrations.md` — two notes on #448's marker.
- `docs/agents/specs/repos/model.md` — only if `pending` must be listed among the sync-state
  statuses.
