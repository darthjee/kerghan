# Issues and Projects UI — States

Empty, loading and error states, confirmations, the scope of v1 and the UI edge cases. Back to the [Issues and Projects UI](../ui.md) hub.

## Empty, loading and error states

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

## Confirmations

- Every Issues confirmation uses one shared `ConfirmModal` (react-bootstrap `Modal`, in `components/common/`). It takes a title, a message, the confirm label, a danger variant and an optional "type to confirm" text. `window.confirm` is not used by the Issues screens.
- Uses: project delete (type the project name), detach repository, issue delete, unlink with unsent changes. The import and attach modals (with the attach warning step) are their own modals and follow the same button rules.
- Cancel gets the initial focus, so Enter never confirms a destructive action. The confirm button is on the right, red (`btn-danger`) for destructive actions, and named for the action ("Delete project", "Delete issue", "Detach", "Unlink and discard", "Replace and link").
- While the confirmed call is in flight the confirm button shows a spinner and both buttons are disabled; an error shows inside the modal.

## Scope

**In scope:** the screens, flows and states of this file (documentation only; the implementation is #492).

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

## UI edge cases

The UI keeps its own U-numbered rows, separate from the E-numbered backend rows of [edge-cases.md](../edge-cases.md), and references an E row where one relates.

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

