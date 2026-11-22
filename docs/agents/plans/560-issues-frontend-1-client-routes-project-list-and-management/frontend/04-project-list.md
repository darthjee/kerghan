# Project list (`#/projects`)

Follow the Repositories split under `components/resources/projects/pages/list/`.

**Controller.**

- **Hash query.** It reads `search` and `page` from the hash query, normalizes them (U6: `page` becomes a positive integer, and `search` is truncated to 100 characters), and writes changes back to the hash.
- **Search (P2).** Search is debounced by about 300 ms, and out-of-order responses are ignored.
- **Paging (U5).** A page past the end, or one left empty, jumps to `totalPages`, or to page 1 when there are no rows.
- **Loading.** It shows "Loading projects…". A failed load shows a danger alert with Retry.

**Rows.**

- The name links to `#/projects/:id`. It is truncated to one line with `title` set to the full text, and uses `overflow-wrap: anywhere` (U8).
- The repository shows `owner/name` with its status badge (Added, Unavailable, Unknown), or "No repository".
- There is no description and no open-issue count.

**Toolbar.** A search box and a "New project" button.

**Empty states.**

- "You have no projects yet." plus the Repositories hint and New project.
- "No projects match "<search>"."

**Deletion notice.** A small in-memory `ProjectNoticeStore` holds the one-time notice set by delete (step 07): "Project deleted." plus "N issues had changes that were not sent to GitHub." when `unsentIssueCount` > 0. The list shows it once and clears it, so a reload does not repeat it.

## Files to Change
- `frontend/assets/js/components/resources/projects/pages/Projects.jsx` (new)
- `frontend/assets/js/components/resources/projects/pages/list/controllers/ProjectsController.js` (new)
- `frontend/assets/js/components/resources/projects/pages/list/helpers/` (new): Helper, Toolbar, Table, Pagination, EmptyState
- `frontend/assets/js/components/resources/projects/ProjectNoticeStore.js` (new)
- `frontend/assets/js/components/resources/projects/listQuery.js` (new): hash query parsing and normalization, which #561 reuses
- `frontend/specs/support/projectsControllerHarness.js` (new) and its spec
- `frontend/specs/assets/js/components/resources/projects/pages/list/` (new): the controller (hash, U5, U6, debounce, out-of-order, retry), the render (rows, badges, empty states, notice, U8) and the store
