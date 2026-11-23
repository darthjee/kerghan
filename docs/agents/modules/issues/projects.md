# Issues and Projects — Projects

The project as the home of issues.
Part of the [Issues and Projects module](../issues.md).

Routes, payloads and error codes are decided in [routes/issues.md](../../backend/routes/issues.md); columns and types in [data-model.md](data-model.md#issues_projects), sync mechanics in [sync.md](sync.md) and UI in [frontend.md](frontend.md).

## Naming

"Project" is Kerghan's concept: an application (backed by a repository) or a life/other project (no repository). It is not a GitHub Project. In these docs "project" always means Kerghan's; the GitHub feature is always written in full as "GitHub Project". No Kerghan-side term is coined for GitHub Projects (out of scope for the epic).

## Repository and ownership

- A project is the home of issues; every Kerghan issue belongs to exactly one project.
- A project has 0 or 1 linked repository (one of the user's repository rows). No repository means a non-code project.
- One repository backs at most one project per user: unique on (user, repository) among non-deleted projects. Several projects with no repository are allowed.
- A project has one owner, taken from the session and never from the request, and is private: another user's project answers `404`.

## Fields

| Field | Rule |
|---|---|
| `name` | Required, trimmed, 1 to 100 characters (counted in characters). Unique per user, case-insensitively, among non-deleted projects (`409 PROJECT_NAME_TAKEN` on a duplicate). A blank name is a validation error. |
| `description` | Optional, trimmed plain text of at most 2000 characters, never rendered as markup. An empty or whitespace-only description is stored as none. |
| Repository | Optional, 0 or 1. |
| Owner | The session's user. |
| Timestamps | Creation and update. |
| Deletion marker | See [Deletion](#deletion). |

- There is no status or archive state in v1.
- The read model adds a repository summary (owner, name, private and the row status Added, Unavailable or Unknown), derived on read and never stored on the project. The read model also adds `openIssueCount`, the project's open issues (it may lag, is computed on read and never stored; [API](../../backend/routes/issues/projects.md#open-issue-count)). There are no other counts and no sync info in v1.
- Columns, types and lengths (name 100, description 2000) are in [data-model.md](data-model.md#issues_projects).

## Creation paths

- **Explicit:** name, optional description, optional repository. The repository must be one of the caller's own repository rows with `added_at` set, in any derived status (Added, Unavailable and Unknown are all allowed). A row of another user or a missing one is hidden behind the same `404` as Add; a row of the caller that is not added answers `409 PROJECT_REPOSITORY_NOT_ADDED` (it reveals only the caller's own row). A repository that already has a project of the user is rejected with `409 PROJECT_REPOSITORY_TAKEN`, pointing at the existing project (`meta.projectId`). A taken name is `409 PROJECT_NAME_TAKEN`. This is the only way to make a non-code project.
- **Shortcut** (from an added repository): takes a repository reference plus an optional `name` and `description`. A repository that is not added is rejected (`409 PROJECT_REPOSITORY_NOT_ADDED`); the shortcut never adds one. If the user already has a project on the repository it returns it (`200`, ignoring `name` and `description`), otherwise it creates one (`201`). The default name is `owner/name` from the repository's latest snapshot, and a name collision answers `409 PROJECT_NAME_TAKEN` (no automatic suffix).
- **Both:** creation is a pure database write; it never enqueues a job or calls GitHub (the first import or sync is a separate, explicit, on-demand action). Both paths share one service method.

## Linked repository unavailable or removed

- A project never loses its repository automatically.
- Local work (reading and editing issues) continues whatever the status.
- GitHub sync is refused while the repository is Unavailable and allowed while it is Unknown; pending writes stay in their markers under the retry and sync-failed rules of [sync.md](sync.md#retries-and-sync_failed).
- A dangling repository reference reads like an Unavailable repository with no summary fields.
- The future "remove an added repository" feature (not built) must refuse with `409` while a non-deleted project of the user uses the repository. The rule is also recorded in [Repositories](../repositories.md#not-built).
- If the integration is deleted, the project is unaffected directly.
- If the user is deleted, their projects (including soft-deleted ones), issues, links and markers are removed for real (the `user.deleted` contract is in [data-model.md](data-model.md#cleanup); remaining cases stay with #493).

## Deletion

- Soft delete: the project gets a deletion timestamp.
- A deleted project answers `404` for every read or write and is excluded from listings, like another user's project. Its issues, links and markers are deleted in the same transaction; the project row stays as a tombstone with its description cleared ([security.md](security.md#project-deletion-removes-the-issues-at-once)).
- Uniqueness of name and repository covers only non-deleted projects, so both can be reused after deletion (enforced by the `deleted_token` unique indexes, see [data-model.md](data-model.md#issues_projects)).
- The project's GitHub links are deleted on deletion, which frees their GitHub issues for another project.
- Pending markers are discarded.
- A live project counts toward the per-user cap (`409 PROJECTS_LIMIT_REACHED`, default 100); tombstones do not count, and the shortcut's existing-project `200` is never refused ([security.md](security.md#per-user-caps-on-stored-data)). Queued or in-flight jobs for a deleted project or user are a no-op (no error, no retry).
- The confirmation warns that unsent changes will not be written to GitHub, and the response says how many issues had them.
- Deletion never makes a GitHub call.
- No restore and no purge in v1.

## Changing a project later

- Name and description can be edited under the creation rules.
- A repository can be attached to a project that has none (same checks as creation; it never syncs).
- Changing to another repository, or detaching, is allowed only while the project has zero links; with any link it is refused with `409 PROJECT_HAS_LINKS` carrying the link count (`meta.linkCount`), and the user unlinks first. The same checks as creation apply and it never syncs. The project row is locked first, so a concurrent link creation cannot race it ([github-link.md](github-link.md#same-repository-rule-and-repository-changes), E62).
- Issues cannot be moved between projects in v1.

## Room for sharing, members and roles

No schema, endpoint or concept for them in v1. Guardrails, so they stay possible later:

1. One service-level access check for every project or issue read or write (today owner only, otherwise `404`), with no scattered `user_id` filters.
2. Issues derive access from their project and carry no authorization owner.
3. The owner's credentials do all GitHub work, whoever triggers it, and link uniqueness stays per owner.
4. The actor is not assumed to equal the owner.

## Edge cases

| Case | Expected behavior | Check |
|---|---|---|
| Two simultaneous creations on one repository | The database uniqueness decides. The loser answers `409` on the explicit path; the shortcut re-reads and returns the winner (`200`). | Concurrency test on both paths. |
| Two simultaneous creations or renames to one name | One wins, the other answers `409`. | Concurrency test. |
| Create or attach on a repository that has only a deleted project | Allowed. | Create and attach after deletion. |
| Repository renamed or transferred on GitHub | Nothing happens to the project; its name is just text and the summary shows the current `owner/name`. | Summary read after a rename. |
| Repository goes Unavailable and returns | The project is untouched; sync is refused only while Unavailable. | Sync gating by status. |
| Repository added but Unavailable at creation | Allowed. | Create with an Unavailable repository. |
| Job or request for a deleted project or user | A job is a no-op; a request answers `404`. | Job and request after deletion. |

## Not decided

Left open on purpose; none has an owner issue yet.

- Members and roles: out of scope for the epic.
- Invitations: out of scope for the epic.
- Ownership transfer: out of scope for the epic.
- Shared visibility, including a member's view when the owner's integration is revoked: out of scope for the epic.
- Archive status: not needed in v1.
- Restore and purge of deleted projects: not needed in v1.
- Moving issues between projects: not needed in v1.

## Open questions

None.

## Required tests

Default tier: e2e with fakes; the cleanup queries and concurrency are DB-backed ([testing.md](testing.md#default-tier-by-category)).

- Another user's project and a deleted project answer `404` on every read and write, and a deleted project is absent from listings.
- A project without a repository can be created; several such projects are allowed.
- A project can link one added repository, in any derived status (Added, Unavailable, Unknown).
- A repository of another user or a missing one answers `404` like Add; a not-added repository of the caller answers `409 PROJECT_REPOSITORY_NOT_ADDED`.
- A repository that already has a project of the user is rejected with `409 PROJECT_REPOSITORY_TAKEN` on the explicit path, pointing at the existing project; a not-added repository of the caller answers `409 PROJECT_REPOSITORY_NOT_ADDED` on both paths, while another user's or a missing row answers `404` like Add.
- The shortcut returns the existing project with `200` (ignoring `name` and `description`) and creates one with `201`; it defaults the name to `owner/name` and answers `409 PROJECT_NAME_TAKEN` on a name collision.
- Creation, by either path, makes no GitHub call and enqueues no job.
- Name rules: trimmed, 1 to 100 characters, blank rejected, case-insensitive uniqueness per user with `409 PROJECT_NAME_TAKEN`. Description rules: trimmed, at most 2000 characters, blank stored as none.
- Uniqueness of name and repository covers only non-deleted projects; both can be reused after deletion.
- Deleting a project releases its links, discards its markers, makes queued jobs a no-op, makes no GitHub call and deletes its issues, tombstones the project (description cleared) and answers `unsentIssueCount`, the count of issues with unsent changes counted before the delete; deleting a user removes their projects (including soft-deleted ones), issues, links and markers.
- Attaching a repository to a project without one works and never syncs; attaching a repository that already has a project is rejected with `409 PROJECT_REPOSITORY_TAKEN`; changing or detaching a repository is allowed at zero links and refused with `409 PROJECT_HAS_LINKS` carrying the link count otherwise, and a concurrent link creation never leaves a link against a changed repository `(db)` (E62).
- `openIssueCount` is on every project object and reads `0` without open issues ([routes/issues/projects.md](../../backend/routes/issues/projects.md#open-issue-count)).
- Project and issue access goes through the single access check.
- GitHub work uses the owner's credentials, whoever triggers it.
- The simultaneous cases of the edge-case table resolve as stated `(db)`.
