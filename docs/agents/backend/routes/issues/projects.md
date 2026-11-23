# Issues and Projects API — Projects

The project routes: object, listing, creation, edit, repository, delete and refusal data. Back to the [Issues and Projects API](../issues.md) hub.

## Projects

| Action | Route | Body | Success |
|---|---|---|---|
| Listing | `POST /projects/mine.json` | `{ page, perPage, search }` | `200` `{ projects, pagination }` |
| Explicit create | `POST /projects/create.json` | `{ name, description?, repository? }` | `201` project |
| Shortcut | `POST /projects/from-repository.json` | `{ repository, name?, description? }` | `201` new project, `200` existing one |
| Show | `POST /projects/:projectId/show.json` | none | `200` project |
| Edit | `POST /projects/:projectId/edit.json` | `{ name?, description? }` | `200` project |
| Repository | `POST /projects/:projectId/repository.json` | `{ repository: <repo ref> \| null }` | `200` project |
| Delete | `POST /projects/:projectId/delete.json` | none | `200` `{ unsentIssueCount }` |

`repository` is always the [repo ref](../issues.md#exposed-identifiers). Both creation routes call the one service method of [projects.md](../../../modules/issues/projects.md#creation-paths). The project refresh route is a [trigger](github-link.md#trigger-routes).

### Project object

```json
{
  "id": "3f2a…c9",
  "name": "Kerghan",
  "description": null,
  "repository": {
    "githubId": 123456, "owner": "darthjee", "name": "kerghan",
    "fullName": "darthjee/kerghan", "private": false, "status": "added"
  },
  "openIssueCount": 4,
  "createdAt": "2026-11-17T12:00:00Z",
  "updatedAt": "2026-11-17T12:00:00Z"
}
```

- `repository` is `null` for a non-code project. `status` is `added`, `unavailable` or `unknown`; a dangling reference reads `unavailable` with the snapshot fields `null`.
- `openIssueCount` is the number of the project's open issues ([below](#open-issue-count)). No other issue counts and no sync info in v1 ([projects.md](../../../modules/issues/projects.md#fields)).
- The same object, with `openIssueCount`, is returned by every route above except delete, and is the listing row.

### Open-issue count

- **Definition.** `openIssueCount` counts the project's issues whose stored local `state` is `open`, whatever their link state. A linked issue counts by its local state (sync pulls GitHub's state into it); a pending local close counts as closed at once.
- **Contract: the value may lag.** Clients must not assume it equals the issue listing's `pagination.total` for `state=open` or reflects a write made a moment earlier. This leaves room for a later cache without an API change.
- **v1 computation: at read time**, no stored column and no cache (so in practice it is exact today).
  - **Listing:** one extra grouped query per page, `SELECT project_id, COUNT(*) FROM issues WHERE project_id IN (:pageIds) AND state = 'open' GROUP BY project_id`, served by the (`project_id`, `state`) prefix of `idx_issues_project_id_state_created_at` ([data-model.md](../../../modules/issues/data-model.md#indexes)). Projects absent from the result read `0`. Never one query per project.
  - **Show, edit, repository change, the shortcut's existing-project `200`:** one indexed `COUNT` for the single project. Create and the shortcut's new-project `201` return `0` without querying.
- **Cost bound:** every count is bounded by the per-project issue cap (`ISSUES_LIMIT_REACHED`).
- **Not added:** sorting or filtering projects by count, and the count on the issue listing (its `pagination.total` already serves that).
- **Rejected:** a stored counter column on `issues_projects`, which every write path (create, edit, bulk, import, sync pull, delete, project deletion) would have to maintain and which could drift.

### Project listing

- `page` integer ≥ 1 (default 1; past the end answers `200` with an empty list); `perPage` integer 1 to 100 (default 50); `search` trimmed, at most 100 characters, case-insensitive literal substring of the name, with `%`, `_` and `\` escaped, as in the Repositories listing. Invalid values answer `400 VALIDATION_FAILED`.
- Live projects only. Sort: name, case-insensitive (stable, since names are unique among live projects), served by the unique (`user_id`, `name`, `deleted_token`) index; no sort parameter.
- `pagination` is `{ page, perPage, total, totalPages }`, counting the rows that match `search`.

### Project creation

Checks in order, for both routes:

1. DTO validation (`400`); `repository` is required on the shortcut.
2. The ref is resolved among the caller's own repository rows; not found answers `404 NOT_FOUND` (`Repository not found`, the same message as Add), so another user's or a missing row is indistinguishable.
3. A row that is not added answers `409 PROJECT_REPOSITORY_NOT_ADDED` on both routes; the shortcut never adds one. This reveals only the caller's own row.
4. Explicit: a repository that already has a live project of the user answers `409 PROJECT_REPOSITORY_TAKEN` with `meta.projectId`. Shortcut: returns that project with `200`, ignoring `name` and `description`.
5. A taken name answers `409 PROJECT_NAME_TAKEN` (the shortcut's default name is `owner/name` from the latest snapshot; no automatic suffix).
6. Live-project cap: inside the transaction, under the user row lock, `409 PROJECTS_LIMIT_REACHED` (the shortcut's existing-project `200` is never refused).
7. Write. Simultaneous creations are decided by the unique indexes: the explicit loser answers the matching `409`, the shortcut loser re-reads and returns the winner with `200`.

No GitHub call and no job, on either route.

### Project edit

- `name` and `description` are both optional; an omitted field is unchanged. `description: null` or a blank string clears it. An empty body, or values equal to the stored ones, answers `200` with no write.
- Same rules as creation; a taken name answers `409 PROJECT_NAME_TAKEN`.

### Project repository

- A ref attaches (project without repository) or changes the repository; `null` detaches.
- The same checks as creation (`404`, `409 PROJECT_REPOSITORY_NOT_ADDED`, `409 PROJECT_REPOSITORY_TAKEN` with `meta.projectId`).
- Changing or detaching while the project has links answers `409 PROJECT_HAS_LINKS` with `meta.linkCount`; checked under the project-row lock ([github-link.md](../../../modules/issues/github-link.md#same-repository-rule-and-repository-changes), E62).
- Setting the current repository again, or detaching a project without one, is a no-op `200` (links or not).
- Never syncs or enqueues a job.

### Project delete

- Soft delete of the project row, hard delete of its issues, as in [projects.md](../../../modules/issues/projects.md#deletion); no confirmation flag (the UI warns beforehand, decided there).
- Answers `200` `{ "unsentIssueCount": 2 }`, the number of issues whose markers were discarded, counted before the issues are deleted. `200` rather than `204` because it has a body.
- A second delete, or any route on a deleted project, answers `404`.

### Refusal data: `error.meta`

Refusals that carry data (`meta.projectId`, `meta.linkCount`, the attach differences, the credential reason) use a new optional `error.meta` object of the standard error shape, set at the throw site. It is decided here; [`architecture/backend.md`](../../../architecture/backend/error-responses.md#error-responses) describes the code as it is, so the implementation adds it there in the change that builds it. It never carries internal ids, GitHub content or credential material.
