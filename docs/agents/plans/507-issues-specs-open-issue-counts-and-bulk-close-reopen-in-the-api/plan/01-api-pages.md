# API pages

Write the API contract for both additions in the `api.md` hub and its pages, from the issue's Solution sections "Open-issue count", "Bulk route shape", "Transaction and locks", "Rate limit" and "Validation and errors".

- **`api.md` (hub):** add `POST /projects/:projectId/issues/bulk-state.json` to the route list (after `issues/import.json`), change "18 routes" to 19 (list and Required tests), and extend Required tests with the count (every project object, one grouped query per listing page `(db)`, `0` when absent, local state) and the bulk call (outcomes in request order, ids only, lock order `(db)`, markers and T1 after commit, rollback, the rate-limit weight and boundary). Drop "with #507's additions" from the "built by" sentence, keeping #563.
- **`api/projects.md`:** add `openIssueCount` to the project object example and its field list; replace "No issue counts or sync info in v1" with "No issue counts other than `openIssueCount`; no sync info"; add a short "Open-issue count" subsection: definition (local `state = open`, any link state), the "may lag" contract, v1 computation at read time (the grouped listing query on the (`project_id`, `state`) prefix of `idx_issues_project_id_state_created_at`, one `COUNT` for single reads, `0` without a query on create and the shortcut's `201`), the cost bound by the issue cap, and the rejected stored counter.
- **`api/issues.md`:** add `Bulk state` to the routes table and a "Bulk close and reopen" section: body, the response shape and its three outcome lists, always `200`, the order of checks, the one-transaction steps (project lock, issues by uuid in id order, state flip with one `Clock` read, links and markers, commit, T1 after commit), the concurrency notes (single Edit unchanged), and the rejected alternatives.
- **`api/errors-and-validation.md`:** add the three validation rows (`issueIds`, duplicates case-insensitive `400`, `state` required with no default), the lowercase matching and echo, and name the bulk route next to Edit in the `ISSUE_EDIT_RATE_LIMITED` catalogue row (with "weight = id count"). No new codes and no new `meta`.

## Files to Change

- `docs/agents/specs/issues/api.md` — route list (19), the "built by" sentence, Required tests.
- `docs/agents/specs/issues/api/projects.md` — `openIssueCount` field, the revised "no counts" line, the count subsection.
- `docs/agents/specs/issues/api/issues.md` — routes table row and the bulk section.
- `docs/agents/specs/issues/api/errors-and-validation.md` — validation rows and the `ISSUE_EDIT_RATE_LIMITED` row.
