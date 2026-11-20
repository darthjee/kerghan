# Issues and Projects API — Issues

The issue routes: object, listing, create and edit, and delete. Back to the [Issues and Projects API](../api.md) hub.

## Issues

| Action | Route | Body | Success |
|---|---|---|---|
| Listing | `POST /projects/:projectId/issues.json` | `{ page, perPage, state, search }` | `200` `{ issues, pagination }` |
| Create | `POST /projects/:projectId/issues/create.json` | `{ title, body?, state? }` | `201` issue |
| Show | `POST /projects/:projectId/issues/:issueId/show.json` | none | `200` issue |
| Edit | `POST /projects/:projectId/issues/:issueId/edit.json` | `{ title?, body?, state? }` | `200` issue |
| Delete | `POST /projects/:projectId/issues/:issueId/delete.json` | none | `200` `{}` |

Field rules are in [Input validation](errors-and-validation.md#input-validation). Every route goes through the project's single access check first; a deleted or foreign project, or an issue of another project, answers `404`.

### Issue object

```json
{
  "id": "8b1e…04",
  "title": "Login fails on Safari",
  "body": "…",
  "state": "open",
  "createdAt": "2026-11-17T12:00:00Z",
  "updatedAt": "2026-11-17T12:00:00.000Z",
  "link": null
}
```

- `link` is `null` for an unlinked issue, otherwise the link object defined in [Link object](github-link.md#link-object).
- `updatedAt` is the value the attach confirmation echoes back (E61); it carries milliseconds.
- Listing rows are the same object **without `body`** (up to 65536 characters each); show, create and edit return it with `body`.

### Issues listing

- `page` and `perPage` as in the project listing (default 50, maximum 100). `state`: `open` (default), `closed` or `all`. `search`: trimmed, at most 100 characters, case-insensitive literal substring of the title, LIKE-escaped as in Repositories. Invalid values answer `400`.
- No filter by link or link state in v1 (a "links by status" index was rejected in [model.md](../model.md#indexes), and derived states mix stored and in-memory data).
- **Sort:** newest created first, `created_at` desc then `id` desc, so edits and sync pulls never reorder pages. No sort parameter.
- **Index:** (`project_id`, `state`, `created_at`) (`idx_issues_project_id_state_created_at`, in [model.md](../model.md#indexes)) serves the `open` and `closed` listings in order. `all` uses the `project_id` prefix and sorts in memory, acceptable at per-project scale.
- The rows' link objects are loaded for the page only (one query for links and marker existence by issue ids, the repository status once per project, the rate-limit waiting sets from memory). A read never enqueues a job.

### Issue create and edit

- Create makes an unlinked issue (`state` defaults to `open`); it never calls GitHub and enqueues nothing. It answers `409 ISSUES_LIMIT_REACHED` when the project is full (checked under the project row lock). Linking is a separate step (import creates an issue from GitHub directly).
- Edit: the edit rate limit applies first (`429 ISSUE_EDIT_RATE_LIMITED`, after DTO validation and before the access check, [security.md](../security.md#request-rate-limits)). An omitted field is unchanged; `body: null` or `''` clears it. Values equal to the stored ones make no write, no marker and no revision bump (E12).
- Editing a synced field of a `linked` or `sync_failed` link upserts the marker in the same transaction and enqueues T1 after the commit; a `gone` link's edits are local only ([sync.md](../sync.md#triggers)). The response's link object reflects the derived *pending* state.

### Issue delete

- **Only an unlinked issue can be deleted.** A linked one, in any link state, answers `409 ISSUE_LINKED`; the user unlinks first, which already carries the unsent-changes confirmation (E63), so there is a single place where a pending write can be dropped.
- Hard delete, never touching GitHub. The check and the delete run under the project-row then issue-row lock, so a concurrent attach (which also locks the project first) cannot leave a link on a deleted issue.
- A second delete answers `404`.
