# Consequence bullets in model, github-link and sync

Add short decision bullets (one line each, ending with a pointer to the matching section of `projects.md`) to the top bullet list of each file. Keep every existing open question for its owner; only remove one when this issue fully answers it, and then say so in the bullet.

- `docs/agents/specs/issues/model.md`:
  - A project carries a deletion marker (soft delete); the projects spec fixes the rules, #486 fixes the column.
  - Uniqueness of project name (per user, case-insensitive) and of repository (per user) covers only non-deleted projects; how MySQL enforces that is for #486 (add it to the existing indexes open question or add a new owned item `(#486)`).
  - Deleting a user removes their projects including soft-deleted ones, with issues, links and markers; keep the existing "cleanup hooks" open question for #486.
  - Project fields live in `projects.md`; this file adds columns, types and lengths later.
- `docs/agents/specs/issues/github-link.md`:
  - A project's links are deleted when the project is deleted, which frees their GitHub issues for another project.
  - A project's repository cannot be changed or detached in v1, only attached to a project that has none, so the existing open question "What happens to links when the project's repository changes?" is answered for v1: remove it and state the rule (a project that gets a repository later has no links yet). Keep "unlinking" for #487 and note that change or detach while no links exist depends on it.
- `docs/agents/specs/issues/sync.md`:
  - Sync is refused while the project's repository is Unavailable and allowed while it is Unknown; pending writes stay in their markers under the normal retry and sync-failed rules.
  - Project creation and attaching a repository never sync or enqueue a job.
  - A queued or in-flight job for a deleted project or user is a no-op (no error, no retry); markers are discarded on project deletion.
  - GitHub work uses the project owner's integrations, whoever triggers it.

Add matching items to each file's "Required tests" only where the new bullet is a rule that file owns (for example "a job for a deleted project is a no-op" in `sync.md`, "links are released when the project is deleted" in `github-link.md`, "uniqueness covers only non-deleted rows" in `model.md`). Keep "Required tests" as the last section.

## Files to Change
- `docs/agents/specs/issues/model.md` — consequence bullets and required tests.
- `docs/agents/specs/issues/github-link.md` — consequence bullets, one resolved open question removed, required tests.
- `docs/agents/specs/issues/sync.md` — consequence bullets and required tests.
