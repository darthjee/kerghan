# Link panel and its controller

`LinkPanelController.js` owns the panel's actions. `LinkPanelHelper.jsx` renders the presenter's output (step 02).

- **Render:**
  - linked: `LinkStateBadge` for `link.state`, `GithubLink` for `#N` (S2), the primary message, secondary lines, last synced and stale, and the action buttons
  - unlinked: the hint and "Link to a GitHub issue", which opens the attach modal (step 04)
  - A notice area for "Already up to date".
- **Refresh (T2):**
  - `202` sets the returned issue and starts `BoundedRereadController`. The button reads "Refreshing…" and is disabled until the re-read stops.
  - `200 alreadyFresh` sets the issue and shows "Already up to date", with no re-read.
  - `ISSUE_LINK_GONE`, `ISSUE_NOT_LINKED` and `PROJECT_REPOSITORY_UNAVAILABLE` re-read the issue once and show the mapped message.
- **Retry sync (T4):** `202` works like Refresh, with "Retrying…". `200` sets the issue, with no re-read.
- **Unlink:**
  - The first call is sent with no confirmation.
  - `ISSUE_UNLINK_HAS_UNSENT_CHANGES` opens `ConfirmModal` ("This issue has changes not yet sent to GitHub. Unlinking discards them.", "Unlink and discard", danger). Confirming calls `unlink(…, { discard: true })` (E63).
  - `ISSUE_NOT_LINKED` re-reads and shows the issue as unlinked (E64, U3).
  - On success, the panel shows the issue as unlinked (`link: null`).
- **U2:** every button is disabled while its call is in flight, and the controller ignores a second call.
- A `404` anywhere calls `onNotFound` (U1). `dispose()` stops any re-read in progress.
- Replace `IssueLinkPanelSlotHelper` with the panel. Keep the file as the slot that renders `<LinkPanel>`, or delete it and render the panel from `IssuePageHelper`, whichever keeps the specs simpler.

## Files to Change
- `frontend/assets/js/components/resources/issues/link/LinkPanel.jsx`, `LinkPanelController.js`, `LinkPanelHelper.jsx` (new)
- `frontend/assets/js/components/resources/issues/pages/show/IssueLinkPanelSlotHelper.jsx`: render the panel, or remove the file and its spec
- specs: controller (each answer above, with a fake clock for the re-reads, E63, E64, U2, U3) and render (every state, the actions and the S2 link)
