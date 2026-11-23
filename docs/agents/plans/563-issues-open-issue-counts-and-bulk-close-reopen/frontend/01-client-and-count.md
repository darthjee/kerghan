# Client and the count column

Add `IssuesClient.bulkState(projectId, { issueIds, state })`. It posts to `/projects/:projectId/issues/bulk-state.json`, putting the project id through `pathId`, and returns the response. Its errors go through `ApiError` with `meta`, as for the other methods. Write the client spec against the fake transport, covering the path, the body, `200`, `429` with `meta.retryAfterSeconds`, and `404`.

Add an "Open issues" column to `ProjectsTableHelper`, after Repository. Each cell shows "N open" (`0 open` included) as muted text from `project.openIssueCount`, with a missing value read as `0`. Invert the existing spec "no description or open-issue count": the description is still absent, and "7 open" is now present. The count is never compared with an issue list's total.

## Files to Change

- `frontend/assets/js/client/IssuesClient.js`: `bulkState`
- `frontend/specs/assets/js/client/IssuesClientSpec.js`: the bulkState specs
- `frontend/assets/js/components/resources/projects/pages/list/helpers/ProjectsTableHelper.jsx`: the column
- `frontend/specs/assets/js/components/resources/projects/pages/list/helpers/ProjectsTableHelperSpec.js`: the count specs
