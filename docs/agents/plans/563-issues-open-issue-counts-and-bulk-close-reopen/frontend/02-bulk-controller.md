# Bulk selection controller

Add a `BulkSelectionController` (plain JS, tested with a fake client and a fake clock) next to `IssuesController`, or fold it into `IssuesController`. It holds:

- **the selection:** a set of issue ids on the current page, with `toggle(id)` and `toggleAll(pageIds)`. "Select all" checks every row on the page, and unchecks them all when all are already checked.
- **clearing:** `clear()` is called by `IssuesController` on every page, filter (state) or search change, and when a new page is adopted. The selection never crosses pages.
- **`apply(state)`:** it sends `bulkState(projectId, { issueIds: [...selection], state })`, with `inFlight` true meanwhile (U2: both buttons disabled). On `200` it:
  - builds the notice from the response: "Closed N issues" or "Reopened N issues" from `changed.length`; "M were already closed" or "M were already open" when `unchanged.length > 0`; "K were no longer found" when `notFound.length > 0`
  - clears the selection
  - calls `IssuesController.load()` once
- **`429 ISSUE_EDIT_RATE_LIMITED`:** it keeps the selection and starts a `RateLimitCountdownController` from `meta.retryAfterSeconds`. The buttons read "Try again in N s" and stay disabled until it ends, and nothing is resubmitted. Other errors go through `errorMessages.describe`, also with the selection kept. A `404` falls through to the list's not-found handling.
- **`dispose()`:** it stops the countdown when the list unmounts.

Write the specs with a fake clock for the countdown (E74 on the UI side), covering each notice part and the clearing rules.

## Files to Change

- `frontend/assets/js/components/resources/issues/list/controllers/BulkSelectionController.js`: new
- `frontend/assets/js/components/resources/issues/list/controllers/IssuesController.js`: clear the selection on page, filter and search changes, and expose the re-read
- `frontend/assets/js/components/resources/issues/list/IssueList.jsx`: create, wire and dispose the bulk controller and its state
- `frontend/specs/assets/js/components/resources/issues/list/controllers/BulkSelectionControllerSpec.js`: new
- `frontend/specs/assets/js/components/resources/issues/list/controllers/IssuesControllerSpec.js`: the clearing specs
