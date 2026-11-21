# Issues and Projects API — Issues

The issue routes: object, listing, create and edit, bulk close and reopen, and delete. Back to the [Issues and Projects API](../api.md) hub.

## Issues

| Action | Route | Body | Success |
|---|---|---|---|
| Listing | `POST /projects/:projectId/issues.json` | `{ page, perPage, state, search }` | `200` `{ issues, pagination }` |
| Create | `POST /projects/:projectId/issues/create.json` | `{ title, body?, state? }` | `201` issue |
| Show | `POST /projects/:projectId/issues/:issueId/show.json` | none | `200` issue |
| Edit | `POST /projects/:projectId/issues/:issueId/edit.json` | `{ title?, body?, state? }` | `200` issue |
| Bulk state | `POST /projects/:projectId/issues/bulk-state.json` | `{ issueIds, state }` | `200` `{ state, changed, unchanged, notFound }` |
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

### Bulk close and reopen

`POST /projects/:projectId/issues/bulk-state.json`, body `{ issueIds: [uuid…], state: "open" | "closed" }`. It changes `state` only, for issues in any link state, with the rules of a single Edit.

```json
{
  "state": "closed",
  "changed":   ["8b1e…04"],
  "unchanged": ["…"],
  "notFound":  ["…"]
}
```

- **Per-issue outcomes, not all-or-nothing.** Every requested id appears in exactly one list, in request order.
  - `changed`: the local state was flipped by this call. A linked issue counts as changed even though its GitHub push is still pending (T1 enqueued), as in the single Edit.
  - `unchanged`: already in the target state (E12: no write, no marker, no revision bump).
  - `notFound`: no issue with that id in **this** project (missing, another project's or user's, or deleted concurrently), all indistinguishable.
- **Ids only, no issue objects**: the UI re-reads the page after the call. `state` is echoed so the response is self-contained; ids are matched and echoed lowercased.
- **Always `200`** once the project resolves, even when every id is `notFound` or `unchanged` (E70). A missing, foreign or deleted project answers `404`; `400` and `429` happen before any work.
- **Order of checks**, as the single Edit: DTO validation (`400`, [rules](errors-and-validation.md#input-validation)) → edit rate limit weighted by the id count (`429 ISSUE_EDIT_RATE_LIMITED`, [security.md](../security.md#request-rate-limits)) → project access check (`404`) → transaction. A refused call applies nothing and consumes nothing (E74).

**One transaction for the whole call** (at most 100 rows, no chunking), in the module's lock order (projects, issues, links, markers):

1. **Lock the project row** (`FOR UPDATE`, live only). Deleted since the access check: roll back, `404` (E67).
2. **Resolve and lock the issues** in one query, `WHERE project_id = :p AND uuid IN (:ids) ORDER BY id FOR UPDATE`. Internal-id order keeps two overlapping calls from deadlocking (E69). Ids not returned go to `notFound` (E66).
3. **Flip `state`** on each issue whose state differs from the target, with `updated_at` from one `Clock` read for the whole call. The others are `unchanged` and get no write.
4. **Links and markers** of the changed issues: load their links in one query, lock them in id order, and upsert the marker of each `linked`/`sync_failed` link (`marked_at` on insert, `updated_at` and `revision` on every change). `gone` links get no marker (local only, E72).
5. **Commit.**
6. **After the commit**, enqueue one T1 per changed `linked`/`sync_failed` link ([sync.md](../sync.md#triggers)). An enqueue failure is handled as in the single Edit (the marker is the durable record; the boot sweep re-enqueues). Nothing is enqueued on rollback.

**Concurrency:**

- Bulk vs bulk, attach, delete or unlink: serialized by the project-row lock; an issue deleted first ends up in `notFound` (E68).
- Bulk vs single Edit: the single Edit is **unchanged** (no project lock added); it holds one issue, then its link and marker, so the lock order prevents a deadlock.
- Bulk vs reconcile commit: same lock order and compare-and-clear; a marker bumped by the bulk call makes the reconcile miss its clear and re-enqueue (T6).
- A database error rolls the whole call back (`500`): nothing applied, nothing enqueued. Partial results come only from `unchanged` and `notFound`, never from failures.
- Paused integrations, missing credentials, Unavailable repositories and GitHub-side differences follow the single Edit's rules (E71).

**Rejected:** `207 Multi-Status` (no precedent in the codebase); all-or-nothing on any `notFound` (one concurrent delete would fail the page's action); returning updated rows (the re-read covers it); one transaction per issue (half-applied pages on failure, 100 round-trips); chunking (unneeded at 100 rows); no project lock (races with attach and project deletion).

### Issue delete

- **Only an unlinked issue can be deleted.** A linked one, in any link state, answers `409 ISSUE_LINKED`; the user unlinks first, which already carries the unsent-changes confirmation (E63), so there is a single place where a pending write can be dropped.
- Hard delete, never touching GitHub. The check and the delete run under the project-row then issue-row lock, so a concurrent attach (which also locks the project first) cannot leave a link on a deleted issue.
- A second delete answers `404`.
