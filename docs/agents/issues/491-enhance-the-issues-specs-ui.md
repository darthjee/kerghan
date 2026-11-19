# Issue: Enhance the Issues specs: UI

## Description

This is part of the epic #483 (Issues and Projects): Kerghan gets **projects** (optionally connected to one repository) and **issues** that belong to a project and may be linked one to one to a GitHub issue, kept in sync both ways by background workers. The feature is first defined as specs under `docs/agents/specs/issues.md` and `docs/agents/specs/issues/*.md` (the lifecycle is in `docs/agents/specs.md`). This issue is documentation only: no code, migrations or endpoints.

### Task

Enhance `docs/agents/specs/issues/ui.md` (created by the first sub-issue of the epic): resolve its open questions, fill gaps and make it precise enough for an implementation issue to build against without making its own decisions.

Focus:
- Screens and navigation for projects, the issue list and an issue.
- Creating a project, creating an issue, linking to a GitHub issue and unlinking.
- How the link and sync state (synced, pending, failed, read-only) are shown.
- Empty, loading and error states.
- Consistency with the existing frontend conventions and the repositories UI.

Keep the other spec files consistent: when a decision here changes another file, update it in the same PR. Specs describe decisions, not code, and the file must keep its "Required tests" section up to date.

### Decisions already made in the epic

- A project is the home of issues; every Kerghan issue belongs to exactly one project. A project may be about code or anything else.
- Project to repository: 0 or 1 linked repository (one of the user's repository rows). A project with no repository is a non-code project. Whether one repository may back several projects of the same user is open.
- Ownership: one user, private (another user's project answers 404). Sharing, members and roles are out of scope, but the spec must not make them impossible later.
- Creation: explicit (optionally picking an added repository, the only way to make a non-code project), plus a shortcut that creates a project from an added repository.
- Issue to GitHub issue: one to one, per user (unique on user and GitHub issue); the link is optional; it can be created from a GitHub issue or by attaching one to an existing Kerghan issue; the GitHub issue must belong to the project's linked repository.
- Sync is two-way; the details (fields, conflict rules, states) are decided in the enhancement issues.
- Workers (from #479, in-process, in-memory queues): on-demand triggers only; outbound writes use a durable pending marker in the database that is re-enqueued at boot; rate limits reuse `retryAfterSeconds` with retry and cooldown, and exhausted retries mark the link as sync failed; jobs receive ids only, and credentials stay in the Integrations module.
- `product.md` says issue data is not persisted by default; this epic changes that and the specs must say what is now stored.

### Notes

Responsible agent: `architect`. Builds on the API spec.

## Problem

`docs/agents/specs/issues/ui.md` is a minimum list with four open questions (screens and navigation, creation flows, wording and placement of the link and sync states, empty and error states) and several "inputs for #491" from the API, sync and security specs. An implementation issue cannot build the Issues screens from it without making its own product decisions.

## Expected Behavior

- `ui.md` has no unresolved open questions, or lists any that remain with the reason and the issue that will settle them.
- The "Required tests" section matches the rules in the file.
- Related spec files are consistent with it.
- No code, migrations or endpoints are added.

## Solution

The spec PR rewrites `ui.md` with the decisions below (closing its open questions and rewriting "Required tests"), and aligns the files that defer to #491. The open-issue count and bulk close/reopen screens are specified fully now, each marked "API in #507"; #491 does not wait for #507, and any detail #507 changes (outcome reporting, rate-limit behaviour) is aligned in #507's own PR.

### Screens and navigation

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

### Creation flows

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

### Project management (`#/projects/:projectId/edit`)

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

This replaces the current `ui.md` line saying the deletion confirmation "shows how many issues have them". The confirmation warns, and the response's count is shown afterwards, as [projects.md](projects.md#deletion) already says. The matching "Required tests" line changes the same way.

### Lists

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

### Issue page and forms

**Issue page (`#/projects/:projectId/issues/:issueId`):**

- A "Back to <project name>" link to the project page; the browser's Back restores the list query.
- The title (as text), an Open/Closed badge, the created and updated dates.
- The link panel (see Link and sync states).
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

### Linking flows

**Shared input.** Import and attach accept `12`, `#12` or `https://github.com/<owner>/<name>/issues/12`. A URL whose `owner/name` differs (case-insensitive) from the project's repository is rejected client-side ("This issue is not in <owner/name>"); anything else unparseable is rejected client-side as "Enter an issue number or GitHub issue URL". Only the number is sent.

**Placement.** Both run in a react-bootstrap modal (as the login modal does), with no new routes. Errors show inside the modal and keep the typed value. Submit shows a spinner and is disabled while the call is in flight.

**Import** ("Import from GitHub" on the project page, only when the project has a repository):

- `import.json` with `{ number }`; `201` closes the modal and navigates to the new issue's page.
- `GITHUB_ISSUE_ALREADY_LINKED`: "This GitHub issue is already linked" with a link to `#/projects/:meta.projectId/issues/:meta.issueId`.

**Attach** ("Link to a GitHub issue" in the link panel of an unlinked issue):

- First call without `confirmUpdatedAt`. Equal values link at once (`200`): close the modal and show the updated issue.
- `ISSUE_ATTACH_CONFIRMATION_REQUIRED`: the same modal turns into a warning naming the fields from `meta.differences` (only names are known, no content), e.g. "GitHub's title and body will replace this issue's title and body." "Replace and link" retries with `confirmUpdatedAt = meta.updatedAt`; Cancel closes with nothing changed.
- If the retry answers the same `409` (the issue changed after the warning), the warning is shown again with the new differences instead of replacing anything (E61).
- `GITHUB_ISSUE_ALREADY_LINKED` behaves as on import; `ISSUE_ALREADY_LINKED` closes the modal and re-reads the issue (it got linked elsewhere).

**Unlink** ("Unlink" in the link panel, in every link state, including while the repository is Unavailable):

- Calls `unlink.json` directly, with no confirmation (unlinking is reversible by attaching again).
- `ISSUE_UNLINK_HAS_UNSENT_CHANGES`: a confirmation "This issue has changes not yet sent to GitHub. Unlinking discards them." Confirming retries with `discardUnsentChanges: true` (E63).
- `ISSUE_NOT_LINKED` is treated as done (E64): show the issue as unlinked.
- After success the panel shows the issue as unlinked.

### Link and sync states

The **link panel** sits on the issue page between the header and the body.

- **Unlinked:** "Not linked to GitHub", plus "Link to a GitHub issue" (only when the project has a repository whose status is not Unavailable; otherwise a muted "Connect a repository to link issues" or "The project's repository is unavailable").
- **Linked:** the primary-state badge, `#N` as an external link (only when `url` starts with `https://github.com/`), the panel message and the actions below.

| Primary state (`state` / `reason`) | Badge | Panel message | Actions |
|---|---|---|---|
| `linked` | **Synced** (success) | "Linked to GitHub #N · last synced X ago" | Refresh, Unlink |
| `pending` | **Pending** (info) | "Changes are waiting to be sent to GitHub." | Refresh, Unlink |
| `rate_limited` | **Rate limited** (warning) | "GitHub's rate limit was reached; sync resumes at HH:MM (in N min)." | Refresh, Unlink |
| `repository_unavailable` | **Repository unavailable** (secondary) | "This project's repository is unavailable, so sync is paused." with a link to `#/repositories` | Unlink |
| `sync_failed` / `retries_exhausted` | **Sync failed** (danger) | "Sync failed after several attempts." | Retry sync, Unlink |
| `sync_failed` / `no_credential` | **Sync failed** | "No GitHub credential can access this repository. Fix it in Integrations." | Retry sync, Unlink |
| `sync_failed` / `credential_invalid` | **Sync failed** | "The GitHub credential for this repository is no longer valid. Fix it in Integrations." | Retry sync, Unlink |
| `sync_failed` / `forbidden` | **Sync failed** | "The GitHub credential for this repository can't update issues. Fix it in Integrations." | Retry sync, Unlink |
| `gone` / `deleted` | **GitHub issue gone** (dark) | "The GitHub issue was deleted. This issue stays in Kerghan; edits stay local." | Unlink |
| `gone` / `moved` | **GitHub issue gone** | "The GitHub issue was moved to another repository. This issue stays in Kerghan; edits stay local." | Unlink |

- "Fix it in Integrations" links to `#/account/integrations`; the three credential reasons are visibly distinct from `retries_exhausted` (E19 to E21).
- **Secondary states** (the rest of `states`) show as smaller lines under the primary message, with the same messages, e.g. Sync failed plus "Changes are waiting to be sent to GitHub."
- **"Last synced X ago"** shows for every linked, non-`gone` state; when `stale` is true it adds "(may be out of date)".
- **Action rules**, derived from `states` so the UI never offers an action the API refuses:
  - `gone` (primary): Unlink only, no Refresh and no Retry sync (E1, E2).
  - `repository_unavailable` anywhere in `states`: no Refresh and no Retry sync; a `sync_failed` reason stays visible.
  - `sync_failed` (and the repository not unavailable): Retry sync, never Refresh.
  - Otherwise: Refresh.
  - Unlink: always.
- **Rate-limit time** shows in local time plus relative, refreshed by a ticker like the existing countdowns. Once the time has passed it reads "Sync should resume shortly."
- The **list rows** use the same badge labels for their primary-state badge (see Lists).
- **Project header** repository status: Added shows no hint; Unavailable shows "Unavailable: sync and linking are paused" with a link to `#/repositories`; Unknown shows "Unknown: not seen in the last repository sync" and linking still works.
- The URL accepted by the link modals is parsed client-side only; the API still receives just the number, so the rejected "URL as identifier" alternative of [github-link.md](github-link.md#not-decided) stands.

### Re-reading after a trigger

The API exposes no "syncing" state, so the UI re-reads. Sync itself stays on demand: these are bounded client-side re-reads after a user action, never a background poll, and a read never enqueues a job.

- **Issue Refresh (T2) answering `202`, and Retry sync (T4) answering `202`:** re-read `show.json` at about 2 s, 5 s and 10 s after the response. Stop early as soon as `lastSyncedAt` is later than at the trigger, or `states` differs from the trigger's response. Meanwhile the button reads "Refreshing…" (or "Retrying…") and is disabled. After the third read it stops quietly; the panel already shows the current state.
- **The same bounded re-read** runs after saving an edit (or Close/Reopen) on a linked, non-`gone` issue, so *Pending* turns into *Synced* (or a failure) without a reload.
- **Issue Refresh answering `200 alreadyFresh`:** a short "Already up to date" notice, no re-read.
- **Retry sync answering `200`** (no-op): show the returned issue, no re-read.
- **Refresh project (T3, `202`):** a notice "Refreshing N issues (M already up to date)" from `enqueued` and `skippedFresh`, or "Everything is up to date" when `enqueued` is 0; then one re-read of the current list page about 10 s later. The button is disabled until then.
- **Window focus:** the issue page and the project page re-read when the window regains focus (as the awaiting-approval view does), at most once every 30 s.
- Timers are cleared when the user navigates away.

### Empty, loading and error states

**Loading and load errors** follow the Repositories page: "Loading projects…", "Loading issues…", "Loading issue…"; a failed load shows a danger alert with the message and a Retry button.

**Not found:** a `404` (or a `400` from a malformed path id) on a project or issue route shows "Project not found" or "Issue not found", with a link back to `#/projects` (or to the project). Deleted, foreign and missing look the same.

**Empty states:**

| Where | Message | Actions |
|---|---|---|
| No projects | "You have no projects yet." and "You can also create one from an added repository on Repositories." (linking to `#/repositories`) | New project |
| Project search, no match | "No projects match "<search>"." | |
| Issues, Open filter | "No open issues." | New issue; Import from GitHub (with a repository) |
| Issues, Closed filter | "No closed issues." | |
| Issues, All filter | "This project has no issues yet." | New issue; Import from GitHub (with a repository) |
| Issue search, no match | "No issues match "<search>"." | |

**Error messages:** the UI shows `ApiError.message` (the API's final English strings) by default, and overrides only the codes where the screen adds something, through one code-to-renderer map in the issues frontend module:

| Code | UI addition |
|---|---|
| `GITHUB_ISSUE_ALREADY_LINKED` | A link to the existing issue (`meta.projectId`, `meta.issueId`) |
| `PROJECT_REPOSITORY_TAKEN` | A link to the existing project (`meta.projectId`) |
| `PROJECT_HAS_LINKS` | "N linked issues use this repository; unlink them before changing it" (`meta.linkCount`) |
| `GITHUB_CREDENTIAL_UNUSABLE` | The reason-specific sentence of the state table (`meta.reason`) plus "Fix it in Integrations" |
| `ISSUE_LINK_RATE_LIMITED`, `ISSUE_EDIT_RATE_LIMITED`, `GITHUB_RATE_LIMITED` | The submit stays disabled and reads "Try again in N s" until `retryAfterSeconds` elapses, then re-enables (no automatic resubmit); the form keeps its values |
| `PROJECT_REPOSITORY_CHANGED` | "The project's repository changed; try again.", input kept |
| `GITHUB_UNAVAILABLE` | "GitHub is unavailable right now; try again." |
| `VALIDATION_FAILED` | `details` listed under the form |
| `ISSUE_NOT_LINKED` (unlink), `404` on delete | Treated as done, no error (see the flows) |

- **Client-side validation** mirrors the API limits (required fields, trimmed lengths counted in code points, issue-number range) through `utils/validation`, as the account forms do; the server stays authoritative.
- `ApiError` today exposes `retryAfterSeconds` but not `error.meta`; the implementation adds a `meta` property (`undefined` when absent).

### Confirmations

- Every Issues confirmation uses one shared `ConfirmModal` (react-bootstrap `Modal`, in `components/common/`). It takes a title, a message, the confirm label, a danger variant and an optional "type to confirm" text. `window.confirm` is not used by the Issues screens.
- Uses: project delete (type the project name), detach repository, issue delete, unlink with unsent changes. The import and attach modals (with the attach warning step) are their own modals and follow the same button rules.
- Cancel gets the initial focus, so Enter never confirms a destructive action. The confirm button is on the right, red (`btn-danger`) for destructive actions, and named for the action ("Delete project", "Delete issue", "Detach", "Unlink and discard", "Replace and link").
- While the confirmed call is in flight the confirm button shows a spinner and both buttons are disabled; an error shows inside the modal.

### Scope

**In scope (this issue, documentation only):**

- Rewrite `docs/agents/specs/issues/ui.md` with every decision above, close its open questions and rewrite its "Required tests".
- Align the files that defer to #491: `api.md` (the "wording, screens, placement, polling cadence are #491's" lines become pointers to `ui.md`), `github-link.md` (the link-state wording line) and any other mention of #491.

**Brought into v1, with the API part in #507** (a new sub-issue of #483: open-issue counts and bulk close/reopen in the API). `ui.md` specifies the screens assuming #507's API and names it:

- **Open-issue count** on each project-list row ("12 open"), from the project listing row's `openIssueCount`.
- **Bulk close/reopen** on the issue list: a checkbox column, a "select all on this page" checkbox, and a bar with "Close selected" / "Reopen selected" when at least one row is selected. Selection is limited to the current page and cleared on page, filter or search change. After the call, a summary notice ("Closed 8 issues; 2 were already closed") and a re-read of the page. Linked issues then follow the bounded re-read rule only on their own issue page; the list just re-reads once. The exact outcome reporting and rate-limit behaviour follow #507.

**Out of scope in v1:**

- Other bulk actions (delete, refresh, unlink).
- Filtering or sorting issues by link state (rejected in the API spec).
- Counts other than open issues (closed, linked, sync failed) and sync summaries on projects.
- GitHub's actual values in the attach warning (`meta.differences` names fields only).
- A Markdown toolbar, image upload or drag-and-drop.
- Live updates (websockets, background polling) beyond the bounded re-reads.
- Showing on the Repositories page which project uses a repository.
- Keyboard shortcuts, i18n, and layouts beyond Bootstrap's responsive defaults.
- Dashboard and analytics views over issues.

### UI edge cases

`ui.md` keeps its own U-numbered rows, separate from the E-numbered backend rows of [edge-cases.md](edge-cases.md), and references an E row where one relates.

| # | Case | Behaviour |
|---|---|---|
| U1 | The project or issue is deleted in another tab while a page is open | The next call answers `404`; the UI shows the "not found" view. |
| U2 | Double click or double submit | Every action button is disabled while its call is in flight. |
| U3 | The link changes under an open attach or unlink modal | The server decides; `ISSUE_ALREADY_LINKED` / `ISSUE_NOT_LINKED` close the modal and re-read the issue (E64). |
| U4 | The session expires mid-form | `ApiClient` opens the login modal; the form stays mounted with its values and the user submits again. |
| U5 | A list page becomes empty (last row deleted) or the page is past the end | Jump to the last non-empty page (`totalPages`), or page 1 when there are no rows. |
| U6 | Invalid hash query (`state=foo`, `page=-1`, a search over 100 characters) | Normalized to defaults (or truncated) before calling, so a URL never causes a `400`. |
| U7 | `rateLimitedUntil` disappears (server restart) or is in the past | Recomputed on the next read; a past time reads "Sync should resume shortly." |
| U8 | Very long titles or unbroken strings | Wrap with `overflow-wrap: anywhere`; list titles truncate to one line with an ellipsis and keep the full text in the `title` attribute. |
| U9 | Typed-name project delete | The typed value, trimmed, must equal the displayed name exactly (case-sensitive). |
| U10 | The issue changes (sync pull or another tab) while its edit form is open | Edit is last-write-wins (no concurrency token). The form keeps the `updatedAt` it loaded. On window focus (throttled to 30 s) it re-reads the issue without touching the fields; if `updatedAt` is newer it shows a banner "This issue changed since you opened it" with "Discard my changes and reload". Save is still allowed. No API change. |
| U11 | Leaving a form with unsaved changes (Cancel, a link, a hash change, closing or reloading the tab) | A dirty form asks "Discard unsaved changes?" through `ConfirmModal` for Cancel and in-app navigation (a `hashchange` away from a dirty form restores the previous hash, then asks), and through the browser's `beforeunload` prompt for close or reload. A clean form leaves silently. |

### Rejected alternatives

Recorded in `ui.md` as a "Rejected alternatives" list, one line each:

1. A project overview route separate from the issue list: nothing to show there in v1.
2. Inline editing: more component state, and no deep link to a form.
3. List state in component state only: Back and reload would lose the filter and page.
4. A shortcut that always opens a prefilled form: an extra step; the form is the fallback only when the name is taken.
5. A plain `<select>` repository picker: breaks past 100 added repositories.
6. A pre-count of unsent changes in the API for the delete confirmation: an extra query and a reversal of "no counts"; the count is shown after the delete instead.
7. A plain confirmation for project delete: the hard delete of every issue with no restore warrants typing the name.
8. Every state as a badge in list rows: noisy; the full set lives on the issue page.
9. Refresh on a `sync_failed` link: confusing next to Retry sync, since a refresh never clears a failure that belongs to an unsent write.
10. No re-read, or a single fixed re-read, after triggers: reads too early or too late, or forces manual reloads.
11. A full UI wording map for every error code: more to keep in sync; the API strings are final English.
12. `window.confirm` for simple confirmations: mixed look, and it blocks tests.
13. A number-only GitHub input: pasting the URL is common; it is parsed client-side, so the API still takes only the number.
14. Always confirming unlink: unlinking is reversible; only unsent changes warrant a warning (E63).
15. An API concurrency token on edit (`ifUpdatedAt`): the focus banner (U10) covers the common case without an API change.
16. Naming the healthy badge "Linked": "Synced" says what the user cares about.

### Backward compatibility

Every change to the existing UI is additive. The touch points for the implementation (#492):

| Area | Change | Compatibility |
|---|---|---|
| Header | A "Projects" link next to "Repositories" (logged in only) | Header specs gain one link; the logged-out and pending views are unchanged |
| Repositories page | A "Project" button on Added rows | Add, filter and refresh are unchanged; the table specs gain the button case |
| `HashRouteResolver` | 7 new routes | Literal segments are registered before parameters (`/projects/new` before `/projects/:projectId`, `…/issues/new` before `…/issues/:issueId`); existing routes are untouched |
| `ApiError` | A new optional `meta` | `undefined` when absent; existing callers are unaffected |
| `ConfirmModal` | New in `components/common/` | The admin users page keeps `window.confirm`; no migration in this epic |
| Dependencies | `react-markdown` and `remark-gfm` ([security.md](security.md#bodies-restricted-markdown)) | Installed through docker-compose only, never on the host |
| Docs | `architecture/frontend.md` (layout, routes, `ApiError.meta`) | Updated by the implementation, not by the spec PR |

### Performance and security

**Security:**

- **S1.** Bodies render only through `IssueBody` under the restricted-Markdown rules of [security.md](security.md#bodies-restricted-markdown); Preview uses the same component. Titles, project names and descriptions, repository names, search echoes and error messages render as React text. The Issues screens have no `dangerouslySetInnerHTML` (static check).
- **S2.** A link's `url` renders only when it starts with `https://github.com/`; external links get `rel="noopener noreferrer"` and `target="_blank"`. The UI never navigates to a URL the user typed: the link modal only extracts the number.
- **S3.** Ids taken from the hash (`:projectId`, `:issueId`) and from `meta.projectId` / `meta.issueId` are checked as uuids client-side before any request path or link is built. A non-uuid shows "not found" with no call. Path segments are always `encodeURIComponent`-ed, so a crafted hash such as `#/projects/..%2Fadmin` cannot change the request path.
- **S4.** Form drafts are never saved to `localStorage` or `sessionStorage` (bodies may hold private content).
- **S5.** No screen names an integration or shows credential data; credential problems point to Integrations generically.

**Performance:**

- **P1.** Lists never load bodies; the default `perPage` is 50, as in the API.
- **P2.** Searches (both lists and the repository picker) are debounced by about 300 ms, and out-of-order responses are ignored: only the latest request's answer is applied.
- **P3.** Preview renders only when its tab is selected, never on each keystroke.
- **P4.** Re-reads are bounded (Re-reading after a trigger) and focus re-reads are throttled to 30 s.
- **P5.** `IssueBody` (with `react-markdown` and `remark-gfm`) is lazy-loaded (`React.lazy`, its own Vite chunk), so pages without bodies pay nothing. While it loads, the body shows as plain text in a `<pre>`.

### Testing

Derived by the spec PR from the decisions (agreed in discussion). It rewrites `ui.md`'s "Required tests" (frontend tier, [testing.md](testing.md#frontend-tests)) to cover every decision above: routes, the creation and shortcut flows (including the name-taken fallback), the project edit sections and typed-name delete with the post-delete notice, lists and hash-query state, the issue page and forms (Preview, Close/Reopen, delete disabled while linked), the linking modals (URL parsing, attach warning re-shown on a stale confirmation, unlink discard), the state table and action rules, the bounded re-reads, empty/loading/error states and the error map, `ConfirmModal`, U1 to U11, and S1 to S5 (S1 and S3 as static or unit checks).
