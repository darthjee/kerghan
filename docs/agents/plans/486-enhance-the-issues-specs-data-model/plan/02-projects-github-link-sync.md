# Update projects.md, github-link.md and sync.md

Add short consequence bullets with pointers to `model.md` and resolve the pointers that defer to #486.

- `projects.md`: replace "columns and types with #486" and "Column types and lengths stay with #486" by pointers to `issues_projects` in `model.md`; replace "how it is enforced in MySQL is for #486" by "enforced by the `deleted_token` unique indexes ([model.md](model.md#...))"; replace "(mechanism: #486, #493)" for user deletion by a pointer to the `user.deleted` contract in `model.md`. Keep the edge-case table in `projects.md`; add the two rows it lacks only if they are project-specific (none expected).
- `github-link.md`: add the link table pointer (unique on `user_id` and `github_issue_id`, unique on `issue_id`, key and number, issues only, base snapshot); keep the three open questions owned by #487; add a required test for the two unique indexes if not already covered by `model.md` (point instead of duplicating).
- `sync.md`: add the marker rules by pointer (coalesced marker, compare-and-clear, boot re-enqueue oldest first, attempts in memory, exhausted retries set `sync_failed` and keep the marker); state that only title, body and state are stored and so only they can sync, and that the base snapshot exists for #488's conflict rules (it may drop it for last-write-wins); keep the five open questions owned by #488. Add required tests only for rules that live in `sync.md` (the restart case already exists).

## Files to Change

- `docs/agents/specs/issues/projects.md` — resolve the four #486 deferrals by pointers.
- `docs/agents/specs/issues/github-link.md` — consequence bullets and a pointer.
- `docs/agents/specs/issues/sync.md` — consequence bullets and a pointer.
