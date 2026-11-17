# Update model.md and github-link.md

Bring the data model and the link spec in line with `sync.md`.

`model.md`:
- `issues_github_links`: the base snapshot is kept (remove "may drop them for last-write-wins"); define `etag` (stored from each `200` `GET`, `NULL` after a `PATCH`), `github_updated_at` (from the `PATCH` response, or the `GET` when nothing was pushed) and `last_synced_at` (every successful reconcile and link creation); `status_reason` lists the four `sync_failed` reasons as final, owned by `sync.md`.
- Marker section: add the lifecycle details (created for `linked` and `sync_failed` links only; `marked_at` on insert, `updated_at` and `revision` on every value-changing edit, from `Clock`; never expires; compare-and-clear miss re-reads; boot enqueues all; several instances) or link to `sync.md#marker-lifecycle` for them.
- Indexes: state that no "links by status" index is needed (statuses are read per link).
- Edge-case row 15 (E55): `state_reason` is an accepted loss, link to `sync.md`.
- "Owned elsewhere" and open questions: remove #488 items; point to `sync.md`.
- Cleanup `integration.deleted`: replace "#488's no-credential rule" with a link to `sync.md`'s integration selection.

`github-link.md`:
- Link-states table: replace the "#488 (E18 to E21)" cell with the concrete setters from `sync.md` (retries exhausted, no candidate, `401` or invalid candidates, `403` or failed probe) and add "retry sync resets to `linked` at once and enqueues".
- Normalization invariant: replace "The exact rules are #488's" with the rule (verbatim, blank body to `NULL`, `NULL` equals `''`, no other normalization).
- Normalized outcomes: name the client operations (`getIssue`, `updateIssue`, `probeIssues`) and their kinds, or link to `sync.md`'s client operations section; keep `renamed` adapter-internal.
- Open questions: remove the #488 item.
- Link creation: note it sets `last_synced_at` (already listed under "Stored on creation"; check only).
- Required tests: add the normalization invariant and the retry-sync reset if not covered by `sync.md`.

## Files to Change
- `docs/agents/specs/issues/model.md` — columns semantics, marker lifecycle, row 15, indexes, open questions.
- `docs/agents/specs/issues/github-link.md` — link-state setters, normalization invariant, client operations, open questions.
