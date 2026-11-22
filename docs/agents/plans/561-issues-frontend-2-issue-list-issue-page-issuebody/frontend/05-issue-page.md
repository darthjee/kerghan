# Issue page
Add `components/resources/issues/pages/IssuePage.jsx` for `#/projects/:projectId/issues/:issueId`. It extracts both ids with `Router.extractParams`.

- **Loading.** `IssueLoadController` loads the project, through `ProjectsClient.show`, and the issue, through `IssuesClient.show`. It mirrors `ProjectLoadController`'s request guard and dispose. A `400` or `404` on the project shows "Project not found". On the issue it shows "Issue not found" with a link back to the project. A malformed id makes no call (S3, U1). Other failures show "Loading issue…", then the danger alert with Retry.
- **Header:**
  - "Back to <project name>" linking to `ProjectPaths.show`, with the name as text
  - the title as text, with `overflow-wrap: anywhere`
  - the Open/Closed badge, and the created and updated dates
- **Link-panel slot.** An empty, documented slot between the header and the body, where #562 mounts its panel. Nothing renders in it.
- **Body.** `IssueBody`.
- **Actions** (`IssueActionsController`):
  - Edit links to `ProjectPaths.editIssue`.
  - "Close issue" or "Reopen issue" calls `IssuesClient.edit(projectId, issueId, { state })` with **only** `state`, and shows the returned issue. The button is disabled in flight (U2). `ISSUE_EDIT_RATE_LIMITED` shows the shared countdown on the button, and a `404` shows "Issue not found".
  - Delete is disabled while `issue.link !== null`, with the hint "Unlink this issue before deleting it". For an unlinked issue it opens `ConfirmModal` (title "Delete issue", message "Delete this issue? This cannot be undone.", confirm "Delete issue", danger). On `200`, or on a `404` counted as done, it navigates to `ProjectPaths.show(projectId)`. An `ISSUE_LINKED` from a race shows "Unlink this issue before deleting it" inside the modal.

Specs:

- the controller: both loads, not found for each id, a malformed id with no call, Retry
- Close and Reopen send exactly `{ state }`
- Delete: disabled while linked, the confirmation, `200` and `404` as done, `ISSUE_LINKED`
- U2
- the render: the title as text, "No description.", the slot rendering nothing

## Files to Change
- `frontend/assets/js/components/resources/issues/pages/IssuePage.jsx` — new
- `frontend/assets/js/components/resources/issues/pages/common/IssueLoadController.js` — new, shared with the edit form
- `frontend/assets/js/components/resources/issues/pages/show/IssueActionsController.js` — new
- `frontend/assets/js/components/resources/issues/pages/show/` — rendering helpers (header, actions, slot)
- `frontend/specs/assets/js/components/resources/issues/pages/` — the specs
