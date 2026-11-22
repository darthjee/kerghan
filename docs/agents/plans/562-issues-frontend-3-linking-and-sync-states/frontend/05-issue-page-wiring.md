# Issue page wiring

- **`IssuePage.jsx`:** mount the link panel through the slot, passing `project`, `issue`, `onIssueChange` and `onNotFound`.
- **Close/Reopen:** after a successful `toggleState` on a linked, non-`gone` issue (`shouldReread`), `IssueActionsController` starts a `BoundedRereadController` that updates the issue. Dispose it on unmount.
- **Saved signal:** `IssueFormController`'s edit success calls `savedIssueSignal.record(issueId, updated)` before `forceLeave(...)`. Create does not, because a new issue is unlinked. On load, `IssuePage` calls `consume(issueId)`. When it returns an issue that is linked and not `gone`, the page starts the bounded re-read with that issue as the trigger response.
- **Focus re-read:** `useFocusReread` re-reads the project and issue quietly (with no loading state) at most once every 30 s. A `404` shows "Issue not found" (U1).
- **Navigation:** all timers are cleared on unmount.

## Files to Change
- `frontend/assets/js/components/resources/issues/pages/IssuePage.jsx`
- `frontend/assets/js/components/resources/issues/pages/show/IssuePageHelper.jsx`
- `frontend/assets/js/components/resources/issues/pages/show/IssueActionsController.js`
- `frontend/assets/js/components/resources/issues/pages/common/IssueLoadController.js`: a quiet `reread()` that keeps the view mounted
- `frontend/assets/js/components/resources/issues/pages/form/IssueFormController.js`: record the signal on edit success
- specs: the re-read after close/reopen (linked vs unlinked vs gone), the signal consumed once (a second load does not re-read), the focus throttle, timers cleared on navigation
