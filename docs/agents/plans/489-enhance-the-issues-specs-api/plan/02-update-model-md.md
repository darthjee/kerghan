# Update model.md

Bring the data model in line with the API decisions.

- `issues_projects` and `issues`: add `uuid` `char(36)`, generated with `randomUUID()` at insert, with unique indexes `idx_issues_projects_uuid` and `idx_issues_uuid`; add them to the Indexes table and check the longest index name stays under 64 characters.
- `issues.updated_at` becomes `datetime(3)` (milliseconds from the injected `Clock`), with a note that the attach confirmation compares it exactly (E61). Other `datetime` columns are unchanged.
- The issue reference is the uuid, not the `int` `id` (the "The issue's reference" note and the "No per-project issue number" bullet).
- The listing index (`project_id`, `state`) becomes (`project_id`, `state`, `created_at`) (`idx_issues_project_id_state_created_at`); replace "#489 decides the sort" with the decided sort (newest created first, `id` desc).
- Single-issue deletion: the API offers it only for an unlinked issue (`409 ISSUE_LINKED` otherwise), so the cleanup becomes "the issue only, refused while a link exists", under the project then issue lock. Update the Overview bullet, the Cleanup section and the Required tests.
- Edge row 6: name the codes (`GITHUB_ISSUE_ALREADY_LINKED`, `ISSUE_ALREADY_LINKED`).
- Scope boundaries: routes, payloads and the listing sort are decided in `api.md`.
- Required tests: the uuid unique indexes; `datetime(3)` round-trips milliseconds.

## Files to Change

- `docs/agents/specs/issues/model.md` — columns, indexes, deletion rule, references to #489.
