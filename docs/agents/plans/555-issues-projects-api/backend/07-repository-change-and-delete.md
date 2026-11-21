# Repository change and delete

- **`ProjectsService.setRepository(userId, uuid, ref | null)`.** One transaction, in the lock order (projects, then links):
  1. Resolve the ref first, outside the lock, with the creation checks: `404`, `409 PROJECT_REPOSITORY_NOT_ADDED`.
  2. `findLiveProject(..., manager, { lock: true })` takes the project row lock first (E62).
  3. Setting the same repository again, or detaching a project without one, is a no-op `200`, links or not.
  4. Attaching to a project without a repository never needs the link check. Changing or detaching counts the project's links under the lock: more than 0 answers `409 PROJECT_HAS_LINKS` with `meta.linkCount`.
  5. A repository that already has another live project of the user answers `409 PROJECT_REPOSITORY_TAKEN` with `meta.projectId`. Map the duplicate-entry race on update the same way.
  6. Update `repository_id` and `updated_at`, then answer the project with its count.

  It never syncs or enqueues anything.
- **`ProjectsService.delete(userId, uuid)`.** One transaction, in the lock order (`model.md#cleanup`, `security.md#project-deletion-removes-the-issues-at-once`):
  1. Lock the project row.
  2. Count the project's issues that have markers (`unsentIssueCount`).
  3. Delete its markers, then its links, then its issues.
  4. Set `description = NULL`, `deleted_at = now`, `deleted_token = id`.

  It answers `{ unsentIssueCount }`. A second delete answers `404`, and it makes no GitHub call. Reuse the delete queries of `IssuesEventsListener`'s `user.deleted` cleanup if they can be scoped by project, rather than writing new ones.

## Files to Change
- `backend/src/issues/projects.service.ts` — `setRepository`, `delete`.
- `backend/src/issues/tests/projects.service.repository.db-spec.ts` — attach, change and detach at zero links; `PROJECT_HAS_LINKS` with the count against seeded links; the no-op cases; `TAKEN` with `meta.projectId`; attach after the other project was deleted (new).
- `backend/src/issues/tests/projects.service.delete.db-spec.ts` — markers, links and issues removed; tombstone with the description cleared; `unsentIssueCount` counted before the delete; second delete `404`; name and repository reusable afterwards (new).
