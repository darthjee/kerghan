# Issue list on the project page
Mount the issue list below `ProjectHeaderHelper` in `show/ProjectPageHelper.jsx`, once the project is loaded. Follow the split of the project list (`pages/list/`) in `components/resources/issues/list/`:

- **`IssuesController.js`.** It holds the state, page, search, loading and error, and loads through `IssuesClient.list(projectId, { state, search, page, perPage: 50 })`. It:
  - reads and writes the hash query through `ListQuery` with `states: ['open', 'closed', 'all']`, normalizing it before calling (U6)
  - debounces the search by about 300 ms
  - ignores out-of-order answers (P2)
  - does the U5 jump: past the end, or emptied, goes to `totalPages`, or page 1 when there are none
  - treats an `undefined` answer (session expired) as no change
- **Helpers:**
  - Toolbar: the state select (Open, Closed, All) and the title search box
  - Table: the title link to `ProjectPaths.issue`, truncated to one line with an ellipsis and the full text in `title`; `overflow-wrap: anywhere` (U8). Then the Open/Closed badge, the created date and `IssueLinkCellHelper`.
  - Pagination
  - EmptyState: "No open issues." and "This project has no issues yet." with "New issue"; "No closed issues."; and `No issues match "<search>".`, with the search echoed as text
- **Loading:** "Loading issues…", and a danger alert with Retry on failure.
- **Header:** add a "New issue" action next to "Edit" in `ProjectHeaderHelper`. "Import from GitHub" and "Refresh project" are #562's.

Reuse `projectsControllerHarness.js`, or a sibling `issuesControllerHarness.js`, and `fetchSequence` for the controller specs.

Specs:

- request building per state, search and page
- normalization of `state=foo`, `page=-1` and a search over 100 characters (U6)
- the debounce and the out-of-order guard with a fake clock
- the U5 jump
- Retry
- each empty state
- the hash restored on reload
- the row rendering, including U8's `title` attribute

## Files to Change
- `frontend/assets/js/components/resources/projects/pages/show/ProjectPageHelper.jsx` — mount the list
- `frontend/assets/js/components/resources/projects/pages/show/ProjectHeaderHelper.jsx` — "New issue" action
- `frontend/assets/js/components/resources/projects/pages/ProjectPage.jsx` — pass the project id and project to the list
- `frontend/assets/js/components/resources/issues/list/IssueList.jsx` — new
- `frontend/assets/js/components/resources/issues/list/controllers/IssuesController.js` — new
- `frontend/assets/js/components/resources/issues/list/helpers/` — Toolbar, Table, Pagination, EmptyState
- `frontend/specs/support/issuesControllerHarness.js` — if needed
- `frontend/specs/assets/js/components/resources/issues/list/` — the specs
