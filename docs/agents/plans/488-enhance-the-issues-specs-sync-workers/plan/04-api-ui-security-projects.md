# Update api.md, ui.md, security.md and projects.md

Record what #488 hands to the owners of routes and UI, and the security rules, without deciding their shapes.

`api.md` (inputs for #489, in its open questions or a "From the sync spec" list):
- Linked issues expose `lastSyncedAt` and a derived `stale` flag next to the primary state and the list of states.
- A single-issue refresh (T2) and a project refresh (T3); a single refresh of a fresh marker-less link answers "already fresh".
- Retry sync (T4) resets the status to `linked` at once and enqueues; the response reflects the derived *pending* state.
- No read endpoint enqueues a job.

`ui.md` (inputs for #491):
- The stale hint and "last synced X ago"; the refresh actions (issue and project); retry sync turns the state to pending at once.

`security.md`:
- Rate-limit pauses and waiting sets are keyed by integration id only; job params are `{ linkId }`; the log field allowlist (`jobId`, `linkId`, outcome kind, error class); credentials are resolved at job time inside Integrations and never stored by Issues.
- Required tests: add the allowlist check if not already covered by the canary sweep.

`projects.md`:
- Replace "under the normal retry and sync-failed rules (#488)" with a link to `sync.md`.

## Files to Change
- `docs/agents/specs/issues/api.md` — inputs for #489.
- `docs/agents/specs/issues/ui.md` — inputs for #491.
- `docs/agents/specs/issues/security.md` — pause key, params, log allowlist.
- `docs/agents/specs/issues/projects.md` — link to `sync.md` instead of #488.
