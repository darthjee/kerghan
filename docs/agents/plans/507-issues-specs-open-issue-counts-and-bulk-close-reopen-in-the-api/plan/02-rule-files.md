# Rule files (projects, model, security, sync)

Make the domain rule files consistent with the API, keeping each addition short and linking to `api/issues.md` or `api/projects.md` for the detail.

- **`projects.md` (Fields, line ~31):** "There are no issue counts or sync info in v1" → the read model adds `openIssueCount` (may lag, computed on read, never stored); no other counts and no sync info. Add it to Required tests if the section lists read-model fields.
- **`model.md`:** in Indexes, note that `idx_issues_project_id_state_created_at` also serves the open-issue count (its (`project_id`, `state`) prefix, one grouped query per listing page); in Cleanup or the lock-order paragraph, add the bulk state change (project, issues in id order, links, markers; one transaction); in Alternatives considered, the rejected stored counter column; Required tests: the grouped count query `(db)` and the bulk lock order `(db)`. No new column, table or migration.
- **`security.md` (Request rate limits):** the Issue edits row names the bulk route; add the rules "a bulk call weighs its id count, checked before the access check, all-or-nothing" and "a refused (`429`) call consumes nothing, for the single Edit and bulk alike"; the rationale line (each edit can write a marker and enqueue a job) covers bulk. Required tests: weight and boundary (`used + weight = max` passes, `+1` refused), a refused call consuming nothing. Keep the file under about 300 lines.
- **`sync.md` (Triggers, T1):** a bulk state change is a set of edits: each changed `linked`/`sync_failed` link gets its marker in the call's transaction and one T1 after the commit, through the per-link dedupe; `gone` links stay local. No new trigger.

## Files to Change

- `docs/agents/specs/issues/projects.md` — Fields line and Required tests.
- `docs/agents/specs/issues/model.md` — Indexes, lock order, Alternatives considered, Required tests.
- `docs/agents/specs/issues/security.md` — Request rate limits and Required tests.
- `docs/agents/specs/issues/sync.md` — T1 row (bulk as a set of edits).
