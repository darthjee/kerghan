# Project read model and open-issue count

- **`issues/project-response.ts`:** `projectResponse(project, summary, openIssueCount)` builds the project object of `api/projects.md#project-object`:
  - `id` is the project's `uuid`, and the internal `id` never appears.
  - It carries `name` and `description` (`null` when none).
  - `repository` is `null` for a non-code project; a dangling reference reads `unavailable` with the snapshot fields `null`.
  - It carries `openIssueCount`.
  - `createdAt` and `updatedAt` are ISO strings.
  - Also add `listingResponse(rows, pagination)` and `deleteResponse(unsentIssueCount)`.
- **`issues/open-issue-count.query.ts`:** `ProjectOpenIssueCounts`, used by the project services.
  - `forPage(projectIds)` makes exactly one grouped query: `SELECT project_id, COUNT(*) … WHERE project_id IN (:ids) AND state = 'open' GROUP BY project_id`, served by `idx_issues_project_id_state_created_at`. Ids missing from the result read `0`, and an empty page runs no query.
  - `forProject(projectId, manager?)` makes one indexed `COUNT`.
  - Create and the shortcut's `201` pass `0` without querying.
- A linked issue counts by its local `state`. There is no stored column and no cache.

## Files to Change
- `backend/src/issues/project-response.ts` — the response mappers (new).
- `backend/src/issues/open-issue-count.query.ts` — the two counts (new).
- `backend/src/issues/tests/project-response.spec.ts` — shape, `null` repository, dangling summary, no internal id or `user_id` (new).
- `backend/src/issues/tests/open-issue-count.db-spec.ts` — `0` without open issues, closed issues not counted, linked issues counted by local state, one query per page whatever the page size (count the queries with a TypeORM logger or a query spy) (new).
