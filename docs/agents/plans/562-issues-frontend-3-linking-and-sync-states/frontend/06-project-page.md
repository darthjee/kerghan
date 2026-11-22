# Project page: header actions, hints, import entries, focus re-read

- **Header (`ProjectHeaderHelper` becomes a component with a controller, `ProjectRefreshController`):**
  - "Import from GitHub" and "Refresh project", only when `project.repository` is not `null`.
  - **Repository hints** under `RepositoryLabel`: Added shows none. Unavailable shows "Unavailable: sync and linking are paused" with a `#/repositories` link. Unknown shows "Unknown: not seen in the last repository sync".
  - **Refresh project (T3):** `202` shows "Refreshing N issues (M already up to date)" from `enqueued` and `skippedFresh`, or "Everything is up to date" when `enqueued` is 0. The list re-reads its current page once, about 10 s later, and the button stays disabled until then.
  - `PROJECT_HAS_NO_REPOSITORY` and `PROJECT_REPOSITORY_UNAVAILABLE` show the mapped message and re-read the project.
- **Empty states:** `IssuesEmptyStateHelper` adds "Import from GitHub" to the Open and All rows when the project has a repository. Pass `project` (or `hasRepository`) down from `ProjectPageHelper` to `IssueList`.
- **List re-read hook:** expose `IssuesController.load()` (it already exists) to the page for the T3 re-read and the focus re-read. The page re-reads the project and the current list page on window focus, at most once every 30 s. Timers and listeners are cleared on unmount.
- Both import entries open the same `ImportIssueModal` (step 04).

## Files to Change
- `frontend/assets/js/components/resources/projects/pages/show/ProjectHeaderHelper.jsx`, `ProjectPageHelper.jsx`
- `frontend/assets/js/components/resources/projects/pages/show/ProjectRefreshController.js` (new)
- `frontend/assets/js/components/resources/projects/pages/ProjectPage.jsx`: the focus re-read and the list handle
- `frontend/assets/js/components/resources/issues/list/IssueList.jsx`, `helpers/IssuesEmptyStateHelper.jsx`
- specs: the header with and without a repository, the three hints, the T3 notices and single re-read (fake clock), the empty-state import entries, the focus throttle
