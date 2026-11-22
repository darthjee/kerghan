# Project page header (`#/projects/:projectId`)

**Loading.** The page reads `:projectId` with `Router.extractParams`.

- A non-uuid id shows "Project not found" with **no** call (U1, S3).
- Otherwise the page calls `ProjectsClient.show` and shows "Loading project…". A failed load shows a danger alert with Retry.
- A `404` or `400` shows "Project not found" with a link to `#/projects`.

**Header.**

- the name, as text, with U8 wrapping
- the description, as plain text
- the repository's `owner/name` with its status badge, or "No repository"
- an "Edit" action to `#/projects/:id/edit`

**Left for later issues:**

- `ProjectPage` composes `ProjectHeader` plus an empty slot where #561 mounts the issue list.
- "New issue" may be rendered, pointing at the placeholder route.
- "Refresh project" and "Import from GitHub" are left to #562.

## Files to Change
- `frontend/assets/js/components/resources/projects/pages/show/` (new): `ProjectPage.jsx`, controller, and `ProjectHeaderHelper.jsx`
- `frontend/assets/js/components/resources/projects/pages/common/NotFoundHelper.jsx` (new): shared with step 07 and #561
- `frontend/specs/assets/js/components/resources/projects/pages/show/` (new): loading, retry, not found for a 404 and a malformed id (with no fetch), and the header render
