# Issues and Projects UI — Screens and flows

Screens, navigation, the creation flows, project management, the two lists, and the issue page and forms. Back to the [Issues and Projects UI](../ui.md) hub.

## Screens and navigation

Hash routes, registered in `HashRouteResolver` like the existing pages (the router already supports `:id` params):

| Route | Screen |
|---|---|
| `#/projects` | Project list, with a "New project" button |
| `#/projects/new` | Explicit creation form |
| `#/projects/:projectId` | Project page: a project header (name, description, repository status, "Refresh project", "Edit") above the project's issue list |
| `#/projects/:projectId/edit` | Edit name, description and repository; a "Delete project" danger zone at the bottom |
| `#/projects/:projectId/issues/new` | New issue form (and the entry to import from GitHub) |
| `#/projects/:projectId/issues/:issueId` | Issue page: view, link state and its actions |
| `#/projects/:projectId/issues/:issueId/edit` | Edit title, body and state |

- The project page **is** the issue list; there is no separate overview (projects carry no counts in v1).
- Editing uses separate `…/edit` routes (as `/admin/users/:id/edit`), with Save and Cancel, never inline edit.
- List state (issue `state` filter, `search`, `page`; the project list's `search` and `page`) lives in the hash query (e.g. `#/projects/:id?state=closed&search=foo&page=2`), so Back from an issue page and a reload restore the list. The router already strips `?…` before matching.
- Deleting a project lives only in the danger zone of the project edit page.
- The header gains a "Projects" link next to "Repositories" (logged-in users only).

## Creation flows

**Explicit form (`#/projects/new`):**

- Fields: Name (required, 1 to 100), Description (optional, up to 2000) and Repository (optional; default "No repository", which makes a non-code project).
- The Repository picker is a search box over the user's **added** repositories, reusing `POST /repositories/mine.json` with `filter: "added"`, `search` (debounced) and `perPage: 20`. Picking a result shows its `owner/name` with a Clear button. No new endpoint.
- With no added repositories at all, the picker shows a hint linking to `#/repositories` ("Add a repository first").
- The form accepts the query `?repository=<githubId>&repositoryName=<owner/name>&name=<name>` to start prefilled (used by the shortcut fallback below). The ref sent is `{ githubId }`; `repositoryName` is only for display.
- `201`: navigate to `#/projects/:id`.
- `PROJECT_REPOSITORY_TAKEN`: the message shows on the Repository field with a link to the existing project (`meta.projectId`).
- `PROJECT_NAME_TAKEN` shows on the Name field. `PROJECT_REPOSITORY_NOT_ADDED` and the repository `404` show on the Repository field. `PROJECTS_LIMIT_REACHED` shows as a form-level error. Wording is in the error-message map.
- The only "New project" entries are a button on `#/projects` and the project list's empty state; nothing is added to the header.

**Shortcut (Repositories page):**

- Every row with status Added gets a "Project" button next to its other actions. One click calls `POST /projects/from-repository.json` with `{ repository: { githubId } }` and no name (the default is `owner/name`).
- `201` (new) or `200` (existing): navigate to `#/projects/:id`. The UI does not distinguish the two.
- `PROJECT_NAME_TAKEN` (a project is already named `owner/name`): navigate to `#/projects/new` prefilled with the repository and the default name, showing the "name taken" error on the Name field so the user picks another.
- Other refusals (`PROJECTS_LIMIT_REACHED`, `PROJECT_REPOSITORY_NOT_ADDED`, `404`) show inline under the button, like Add errors today.
- While the call is in flight the button shows a spinner and is disabled.

## Project management (`#/projects/:projectId/edit`)

Three independent sections:

1. **Details:** Name and Description with Save and Cancel (`edit.json`). Save goes back to the project page; an unchanged Save makes the call and simply returns (`200`, no write). `PROJECT_NAME_TAKEN` shows on the Name field.
2. **Repository:** the current repository (`owner/name` and its status badge) or "No repository". Its actions run immediately, separately from the details Save:
   - "Change" (or "Connect a repository" when there is none) opens the same search picker as creation and calls `repository.json` on pick.
   - "Detach" asks a plain confirmation and calls `repository.json` with `null`.
   - `PROJECT_HAS_LINKS` shows "N linked issues use this repository; unlink them before changing it" from `meta.linkCount`. The project object has no link count, so the buttons are never pre-disabled; the refusal is the only signal.
   - `PROJECT_REPOSITORY_TAKEN` (with a link to `meta.projectId`), `PROJECT_REPOSITORY_NOT_ADDED` and the repository `404` show in this section.
3. **Danger zone:** "Delete project".
   - The confirmation requires typing the project name to enable Delete (no restore exists, and it hard-deletes every issue and link).
   - It warns, in general terms, that the project's issues and GitHub links are deleted and that changes not yet sent to GitHub are lost. It shows no count: the count is only known after the delete.
   - After `200`, the page navigates to `#/projects`, which shows a one-time notice "Project deleted." and, when `unsentIssueCount` > 0, "N issues had changes that were not sent to GitHub." The notice is carried in memory, not in the URL, so a reload does not repeat it.
   - `404` (already deleted elsewhere) is treated as done: navigate to `#/projects` with "Project deleted."

The confirmation warns in general terms and the response's count is shown afterwards, as [projects.md](../projects.md#deletion) already says.

## Lists

Both lists follow the Repositories page: a react-bootstrap `Table` and the same helper split (toolbar, table, pagination, empty state). Their query state lives in the hash query (see Screens and navigation).

**Project list (`#/projects`):**

- Toolbar: a name search box and a "New project" button. Pagination below.
- Rows: the name (a link to `#/projects/:id`) and the repository's `owner/name` with its status badge (Added, Unavailable, Unknown), or "No repository". No description in the list.

**Project page (`#/projects/:projectId`):**

- Header: name, description (plain text), and the repository's `owner/name` with its status badge (or "No repository"). Actions: "New issue"; "Import from GitHub" and "Refresh project" (only when the project has a repository); "Edit".
- Toolbar: a state select (Open by default, Closed, All), a title search box. Pagination below.
- Rows: the title (a link to the issue page), an Open/Closed badge, the created date, and the link column:
  - unlinked: "—";
  - linked: `#N` as an external link to the link's `url` (only when it starts with `https://github.com/`), plus one badge for the primary state (`state`, i.e. `states[0]`) when it is not plain `linked`, plus a muted "stale" hint when `stale` is true.
- The full set of states, the reason and the actions live on the issue page only.

## Issue page and forms

**Issue page (`#/projects/:projectId/issues/:issueId`):**

- A "Back to <project name>" link to the project page; the browser's Back restores the list query.
- The title (as text), an Open/Closed badge, the created and updated dates.
- The link panel (see [Link and sync states](linking-and-sync.md#link-and-sync-states)).
- The body through the shared `IssueBody` component; an empty body shows a muted "No description."
- Actions:
  - "Edit".
  - "Close issue" / "Reopen issue": calls `edit.json` with `{ state }` only.
  - "Delete": shown but disabled while the issue is linked, with the hint "Unlink this issue before deleting it" (the issue object says whether it is linked, so no call is wasted). An `ISSUE_LINKED` from a race shows the same message. For an unlinked issue, a plain confirmation ("Delete this issue? This cannot be undone.") and then navigation to `#/projects/:projectId`. A `404` on delete is treated as done.

**New issue (`…/issues/new`) and edit (`…/issues/:issueId/edit`) forms:**

- Title: required, 1 to 256 characters.
- Body: Markdown with **Write / Preview** tabs. Write is a plain textarea (up to 65536 characters, never trimmed). Preview renders through the same `IssueBody`, so the user sees the restricted-Markdown result (escaped HTML, images as links) before saving.
- The edit form also has a State select (Open, Closed); new issues are always created open.
- On a linked issue the edit form notes "Changes are sent to GitHub issue #N"; on a `gone` link, "The GitHub issue is gone; changes stay in Kerghan."
- Save navigates to the issue page; Cancel goes back without a call. Create navigates to the new issue's page.
- `ISSUES_LIMIT_REACHED` (create) and `ISSUE_EDIT_RATE_LIMITED` (edit, with its wait) show as form-level errors that keep the typed values. Wording is in the error-message map.

