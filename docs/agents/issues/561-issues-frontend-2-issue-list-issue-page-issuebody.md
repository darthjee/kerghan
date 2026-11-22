# Issue: Issues: frontend 2 (issue list, issue page, IssueBody)

## Description

This issue is part of epic #483 (Issues and Projects). Kerghan gets **projects**, each optionally connected to one repository. It also gets **issues** that belong to a project and may be linked one to one to a GitHub issue. Background workers keep each linked pair in sync both ways. The specs define the feature in `docs/agents/specs/issues.md` and `docs/agents/specs/issues/*.md`, and the lifecycle is in `docs/agents/specs.md`. The specification phase is finished.

This issue builds the second part of the **UI**: the issue list on the project page, the issue page, the issue create and edit forms, and the shared `IssueBody` component. The specs are the source of truth, and this issue makes no product decision of its own. If a decision has to change, the same PR updates the spec (`docs/agents/specs.md`, lifecycle step 2). #492 spawned the implementation issues.

## Builds against

- `docs/agents/specs/issues.md` (the index)
- `docs/agents/specs/issues/ui.md#required-tests`
- `docs/agents/specs/issues/ui/screens-and-flows.md#lists` (the project page part) and `#issue-page-and-forms`
- `docs/agents/specs/issues/ui/linking-and-sync.md#link-and-sync-states`, for the badge wording of the list's link column only
- `docs/agents/specs/issues/ui/decisions.md` (S1 to S5, P1 to P5, the `react-markdown` and `remark-gfm` dependency)
- `docs/agents/specs/issues/ui/states.md` (issue loading and empty states, the error-message map, `ConfirmModal`, U1, U2, U4, U5, U6, U8 and U11)
- `docs/agents/specs/issues/security.md#github-and-user-content` (titles as text, bodies as restricted Markdown) and `#required-tests` (the content tests)
- `docs/agents/specs/issues/api/issues.md` (the issue object, listing, create, edit and delete)
- `docs/agents/specs/issues/testing.md#frontend-tests`

## Depends on

- #556 (Issues: issues API), merged
- #560 (Issues: frontend 1), merged

## What already exists (reuse, do not redo)

#560 shipped these. Paths are under `frontend/assets/js/` unless they start with `frontend/specs/`.

- **Client:** `client/IssuesClient.js` covers `list`, `create`, `show`, `edit` and `delete` (plus the link routes for #562), with the uuid guard (`client/pathId.js`) and `ApiError.meta`. Use it as is.
- **Error map:** `components/resources/projects/errors/errorMessages.js` (`describe`, `fieldOf`, `isProjectNotFound`). This issue adds the issue and rate-limit codes to it.
- **Shared pieces:**
  - `components/common/confirmModal/ConfirmModal.jsx`
  - the dirty-form guard: `components/common/forms/DirtyFormPrompt.jsx`, `useDirtyFormGuard.js`, `DirtyFormGuardController.js`
  - `utils/ids/uuid.js`
  - `components/resources/projects/listQuery.js`, already written for the issue list's `state` filter
  - `components/resources/projects/paths.js`
- **Project page:** `ProjectPage.jsx`, `show/ProjectPageHelper.jsx` (the header, with a place for the issue list below it), `show/ProjectHeaderHelper.jsx`, and `pages/common/` (`ProjectLoadController`, `NotFoundHelper`, `LoadErrorHelper`, `ProjectLoadViewHelper`, `buildLoadEffect`, `formErrors`).
- **List pattern:** `pages/list/` of the project list (Controller, Handlers, Toolbar, Table, Pagination, EmptyState), with the debounced search, the out-of-order guard and the U5 jump.
- **Routes:** the three issue routes (`issue-new`, `issue`, `issue-edit`) are registered in `utils/routing/HashRouteResolver.js` and map to `pages/ProjectsPlaceholder.jsx` in `components/helpers/AppHelper.jsx`.
- **Specs:** `frontend/specs/support/issuesBuilders.js`, `fetchSequence.js`, `fakeWindow.js`, and the static spec `frontend/specs/assets/js/components/resources/projects/securityStaticSpec.js`.

## Task

- **Issue list on the project page (`#/projects/:projectId`).** It goes below the existing header:
  - the toolbar: a state select (Open by default, Closed, All) and a title search box, debounced, with out-of-order answers ignored (P2)
  - pagination, with `perPage` 50 (P1)
  - the hash query `state`, `search` and `page`, normalized before calling (U6), with the U5 jump
  - rows: the title (a link to the issue page, one line with an ellipsis and the full text in `title`: U8), an Open/Closed badge, the created date, and the link column
  - "Loading issues…", the danger alert with Retry, and the four issue empty states. "New issue" shows in the Open and All empty states and in the header. #562 adds "Import from GitHub".
- **The link column, complete.** It shows:
  - "—" for an unlinked issue
  - `#N` as an external link only when `url` starts with `https://github.com/`, with `rel="noopener noreferrer"` and `target="_blank"` (S2)
  - the primary-state badge when `state` is not `linked`, with the badge wording and variant of the `linking-and-sync.md` state table
  - a muted "stale" hint when `stale` is true

  The badge is a shared component, so #562's link panel reuses it.
- **Issue page (`#/projects/:projectId/issues/:issueId`).** It shows:
  - "Back to <project name>", which loads the project as well as the issue
  - the title as text, the Open/Closed badge, and the created and updated dates
  - an empty slot between the header and the body, where #562 puts the link panel. Nothing renders there in this issue.
  - the body through `IssueBody`, or a muted "No description."
  - the actions: Edit, then Close issue or Reopen issue, which send `{ state }` only. Delete is disabled while the issue is linked, with the hint "Unlink this issue before deleting it". An `ISSUE_LINKED` from a race shows the same message. An unlinked issue's delete goes through `ConfirmModal` ("Delete this issue? This cannot be undone.", "Delete issue") and then navigates to the project page. A `404` on delete counts as done.
  - "Loading issue…", Retry, and "Issue not found" for a `404` or a malformed id, with a link back to the project (U1)
- **Issue forms (`…/issues/new` and `…/issues/:issueId/edit`).** They contain:
  - Title, required, 1 to 256 code points trimmed
  - Body with Write and Preview tabs. Write is a plain textarea, up to 65536 characters and never trimmed. Preview renders through `IssueBody`, and only while its tab is selected (P3).
  - a State select (Open, Closed) on the edit form only
  - the notes on the edit form: "Changes are sent to GitHub issue #N" on a linked issue, and "The GitHub issue is gone; changes stay in Kerghan." on a `gone` link
  - Save, which navigates to the issue page. Create navigates to the new issue's page. Cancel goes back without a call.
  - form-level errors that keep the typed values: `ISSUES_LIMIT_REACHED` on create, `ISSUE_EDIT_RATE_LIMITED` on edit, and `VALIDATION_FAILED` with its `details`
  - the dirty-form guard (U11), and no draft in storage (S4)
- **Rate-limit countdown, shared.** A reusable "Try again in N s" countdown, specified with a fake clock:
  - the submit stays disabled and counts down from `retryAfterSeconds`
  - then it re-enables, with no automatic resubmit, and the form keeps its values
  - the error map handles all three codes: `ISSUE_EDIT_RATE_LIMITED`, `ISSUE_LINK_RATE_LIMITED` and `GITHUB_RATE_LIMITED`

  This issue wires it to the edit form, and #562 wires it to its link modals.
- **`IssueBody`.** It renders the restricted Markdown of `security.md#bodies-restricted-markdown` with `react-markdown` and `remark-gfm`:
  - Both versions are pinned and installed through docker-compose only.
  - The rules are met with `urlTransform`, `components` overrides for `a` and `img`, and no raw-HTML plugin.
  - It is lazy-loaded (`React.lazy`, its own Vite chunk). The body shows as plain text in a `<pre>` while it loads (P5).
- **Routes.** The three issue routes map to the new screens in `AppHelper.jsx`, and `ProjectsPlaceholder.jsx` and its spec are removed. The routes spec keeps passing.
- **Security static spec.** Extend `securityStaticSpec.js` to the issue screens and `IssueBody`:
  - no `dangerouslySetInnerHTML`, `innerHTML` or raw-HTML plugin (`rehype-raw` or equivalent)
  - titles rendered as text
  - no storage writes
- **Docs.** Update `docs/agents/architecture/frontend.md` (the issue screens, `IssueBody`, the countdown and the new dependency).

## Out of scope

- The link panel and its state table, the import, attach and unlink flows, re-reading after a trigger, "Refresh project", "Import from GitHub", and U3, U7 and U10: #562.
- The open-issue count on project rows, and bulk close and reopen: #563.

## Acceptance criteria

- Every Required test in `ui.md#required-tests` that falls in this scope is implemented, on the tier given by [`testing.md`](https://github.com/darthjee/kerghan/blob/main/docs/agents/specs/issues/testing.md). That covers:
  - Lists (the issue list and the link column)
  - Issue page and forms
  - the issue-side empty, loading and error states, including the "Try again in N s" countdown for all three rate-limit codes
  - U1, U2, U4, U5, U6, U8 (titles) and U11 on the issue screens
  - S1 (static, plus the `IssueBody` unit specs), S2, S3, S4 and P5
- One frontend unit spec per row of the rendering table in `security.md#required-tests`:
  - raw HTML is shown as text
  - `javascript:`, `data:`, relative and protocol-relative links render as text
  - `http`, `https` and `mailto` links carry `rel="noopener noreferrer"`
  - an image produces no `<img>` and no request
  - task list checkboxes are disabled
  - `@mention` and `#123` are plain text
- Frontend specs that cover an edge case carry its E-id, so the backend `edge-cases.coverage.spec.ts` sweep finds them.
- No decision differs from the specs. If one has to, the same PR updates the spec. The same PR also aligns the #561 row of the implementation table in `docs/agents/specs/issues.md` with the *Builds against* list above. That row today lists only `ui/screens-and-flows.md`, `ui/decisions.md` and `security.md`.
- The frontend checks pass:
  - `docker-compose run kerghan_fe yarn coverage`
  - `docker-compose run kerghan_fe yarn lint`

## Notes

- **Responsible agent:** `frontend`.
- **Review:** `security`, for the rendering of GitHub-sourced and user content (S1, S2) and the ids in paths and links (S3).
