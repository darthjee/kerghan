# Import and attach modals

Both are react-bootstrap modals, with no new routes. They follow the `ConfirmModal` button rules (Cancel first, confirm on the right). Errors show inside the modal and keep the typed value. Submit shows a spinner and is disabled in flight (U2).

- **`IssueNumberModal`:** the shared input and the client-side parsing from step 01. It holds the `RateLimitCountdownController` for `ISSUE_LINK_RATE_LIMITED` and `GITHUB_RATE_LIMITED`: the submit reads "Try again in N s" and re-enables, with no automatic resubmit.
- **Import (`ImportIssueController`):**
  - `IssuesClient.import(projectId, { number })`
  - `201` closes the modal and pushes `ProjectPaths.issue(projectId, issue.id)`.
  - `GITHUB_ISSUE_ALREADY_LINKED` shows the message with its link.
  - `GITHUB_CREDENTIAL_UNUSABLE`, `GITHUB_ISSUE_NOT_FOUND`, `ISSUES_LIMIT_REACHED`, `PROJECT_REPOSITORY_CHANGED` and `GITHUB_UNAVAILABLE` go through the error map.
- **Attach (`AttachIssueController`):**
  - The first call is sent without `confirmUpdatedAt`. A `200` closes the modal and calls `onIssueChange(issue)`.
  - `ISSUE_ATTACH_CONFIRMATION_REQUIRED` switches to the warning step. It names the fields of `meta.differences` only ("GitHub's title and body will replace this issue's title and body."), and offers "Replace and link" (danger) and Cancel.
  - "Replace and link" retries with `confirmUpdatedAt = meta.updatedAt`. Another `409` shows the warning again with the new differences (E61).
  - `ISSUE_ALREADY_LINKED` closes the modal and re-reads the issue (U3).
  - `GITHUB_ISSUE_ALREADY_LINKED` behaves as on import.
- The warning sentence is built from a fixed field-name table (`title`, `body`, `state`), never from GitHub content.

## Files to Change
- `frontend/assets/js/components/resources/issues/link/modals/IssueNumberModal.jsx`, `ImportIssueModal.jsx`, `ImportIssueController.js`, `AttachIssueModal.jsx`, `AttachIssueController.js`, `attachWarning.js` (new)
- specs: the parsing paths, import (201 navigation, already linked, the countdown), attach (direct link, the warning, the retry, E61 on a second `409`, U3), U2
