# Bulk bar, checkboxes and notice

- **`IssuesTableHelper`:** add a first column of checkboxes, one per row, each labelled for the issue title with an `aria-label`. The header gets a "select all on this page" checkbox, checked when every row is selected and indeterminate (or unchecked) when only some are.
- **`IssuesBulkBarHelper` (new):** render it only when at least one row is selected. It shows "N selected", plus "Close selected" and "Reopen selected" (`btn-outline-secondary`, with a spinner on the clicked button while in flight). Both buttons are disabled in flight and during the countdown, and then read "Try again in N s". Errors show inline in the bar.
- **The notice:** a dismissible success `Alert` above the table, with the summary sentence built in step 02. It is shown as text, never as HTML.
- **`IssuesHandlers`:** add `onToggle`, `onToggleAll`, `onBulkClose`, `onBulkReopen` and `onDismissNotice`.
- **Empty states:** no checkbox column and no bar when the list has no rows.

Write render specs for the column, select all, the bar visibility, the button states (U2 and the countdown), each notice variant, and the escaping of titles in the `aria-label`.

## Files to Change

- `frontend/assets/js/components/resources/issues/list/helpers/IssuesTableHelper.jsx`: the checkbox column
- `frontend/assets/js/components/resources/issues/list/helpers/IssuesBulkBarHelper.jsx`: new
- `frontend/assets/js/components/resources/issues/list/helpers/IssuesHelper.jsx`: render the bar and the notice
- `frontend/assets/js/components/resources/issues/list/helpers/IssuesHandlers.js`: the new handlers
- `frontend/specs/assets/js/components/resources/issues/list/helpers/`: the matching specs
