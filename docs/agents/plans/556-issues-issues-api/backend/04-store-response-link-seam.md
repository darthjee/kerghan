# Store, response and link presenter seam

## `issue-store.ts` — `IssueStore`

The `issues` reads and writes, always scoped by the project's internal id that `IssuesAccess` resolved. There is never a `user_id` filter. Methods take an optional `EntityManager` where they run inside a transaction.

- `page(projectId, input)`:
  - `WHERE project_id = ?`, plus `AND state = ?` unless `state = 'all'`;
  - plus `AND title LIKE ? ESCAPE '\\'` with `%${escapeLike(search)}%` when `search` is non-empty; the comparison is case-insensitive under the table's collation, as in the project listing;
  - `ORDER BY created_at DESC, id DESC`, `LIMIT/OFFSET`;
  - it selects every column except `body` (listing rows have no body, so it is never read for a page);
  - it returns `{ issues, total }`, with `total` counting the matching rows. A page past the end is empty.
- `countInProject(manager, projectId)` — the cap count. It runs under the project row lock.
- `insert(manager, row)` — the `uuid` comes from `randomUUID()` in the service.
- `update(manager, issueId, changes, updatedAt)` — it writes only the changed fields plus `updated_at`.
- `delete(manager, issueId)`.

## `issue-response.ts` — the wire shapes

These are pure functions, like `project-response.ts`. Every field is copied explicitly and never spread, so `id` (internal), `project_id` and nothing else internal can leak.

- `IssueResponse { id (uuid), title, body, state, createdAt, updatedAt, link }`:
  - `createdAt` is an ISO string with second precision;
  - `updatedAt` is `toISOString()`, which keeps milliseconds.
- `IssueListRow` is the same object **without `body`**.
- `IssuesPagination { page, perPage, total, totalPages }` and `IssueListingResponse { issues, pagination }`.
- `IssueDeleteResponse` is `{}`.

## `issue-link-presenter.ts` — the seam

`IssueLinkPresenter` is an injectable with one method, `forIssues(issueIds: number[], manager?): Promise<Map<number, IssueLinkResponse>>`, where `IssueLinkResponse` is an opaque `Record<string, unknown>` type for now. The response builders read `map.get(issue.id) ?? null`.

- **This issue's implementation returns an empty map**, so `link` is always `null`. The doc comment says #557 fills it in with the link object (`api/github-link.md#link-object`), loaded once per page: links and marker existence by issue ids, the repository status once per project, and the waiting sets from memory.
- Listing calls it once per page and show/create/edit call it once per issue, so #557 never changes call sites.

## Files to Change

- `backend/src/issues/issue-store.ts` — the store.
- `backend/src/issues/issue-response.ts` — the wire shapes.
- `backend/src/issues/issue-link-presenter.ts` — the presenter seam.
- `backend/src/issues/tests/issue-response.spec.ts`:
  - no internal field in any shape;
  - listing rows have no `body`;
  - `updatedAt` keeps milliseconds;
  - `link` is `null` when the map has no entry.
