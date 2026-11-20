# Issues and Projects — UI

Decided. Part of the [Issues and Projects specs](../issues.md).

This file defines the screens, flows and states of the Issues and Projects interface. The implementation issues #560, #561 and #562 (and #563 for the #507 parts) build against it without making its own product decisions. The API contract is [api.md](api.md); the link states are [github-link.md](github-link.md#link-states); the sync behaviour is [sync.md](sync.md). The open-issue count and bulk close/reopen are specified here and marked "API in #507". The detail is split into the focused pages listed under [Pages](#pages).

## Open questions

None left in this file. One dependency: the open-issue count on project rows and bulk close/reopen need the API of #507 (a sub-issue of #483); they are specified in [Scope](ui/states.md#scope) and implemented once #507 lands.

## Required tests

Frontend tier ([testing.md](testing.md#frontend-tests)), in the three layers (client, controllers, render), with typed builders and a fake clock for timers:

- **Routes.** The seven routes resolve to their screens; literal segments win over parameters (`/projects/new` before `/projects/:projectId`, `…/issues/new` before `…/issues/:issueId`); the header "Projects" link shows for logged-in users only.
- **Creation.** The explicit form: fields, limits, the search picker over added repositories (`filter: "added"`, debounced, out-of-order answers ignored), the "Add a repository first" hint, prefill from the query, `201` navigation, and the field-level errors for `PROJECT_REPOSITORY_TAKEN` (with the link), `PROJECT_NAME_TAKEN`, `PROJECT_REPOSITORY_NOT_ADDED`, the repository `404` and the form-level `PROJECTS_LIMIT_REACHED`. The shortcut: `201` and `200` both navigate, `PROJECT_NAME_TAKEN` opens the prefilled form with the error, other refusals show inline, and the button is disabled with a spinner in flight.
- **Project management.** Details Save and Cancel (unchanged Save returns); Change, Connect and Detach act immediately; `PROJECT_HAS_LINKS` shows `meta.linkCount`; the delete confirmation needs the typed name (case-sensitive, trimmed: U9), warns without a count, and after `200` navigates to `#/projects` with the one-time notice including `unsentIssueCount` when above 0; a `404` on delete counts as done.
- **Lists.** Both lists render their rows and columns; the hash query holds and restores `state`, `search` and `page`; invalid values normalize before calling (U6); a page past the end or emptied jumps to the last non-empty page (U5); link-column rendering (unlinked, `#N` external link only for `https://github.com/`, primary-state badge, stale hint).
- **Issue page and forms.** Actions, Close/Reopen sending `{ state }` only, Delete disabled while linked and `ISSUE_LINKED` showing the same message, delete confirmation and `404` as done; the forms' limits, Write/Preview through `IssueBody` (rendered only when the tab is selected), the linked and `gone` notes, and the form-level errors keeping the typed values.
- **Linking.** Input parsing (`12`, `#12`, a URL; a URL of another repository rejected client-side; anything else rejected); import with `GITHUB_ISSUE_ALREADY_LINKED`; attach with a direct link, the differences warning, the retry with `confirmUpdatedAt`, and the warning shown again on a second `409` (E61); `ISSUE_ALREADY_LINKED` closing and re-reading; unlink with no confirmation, the discard confirmation (E63), and `ISSUE_NOT_LINKED` as done (E64).
- **States.** Every row of the state table (badge, message, actions: E1, E2, E17 to E21), secondary states, "last synced" and the stale hint, every action rule derived from `states` (including `repository_unavailable` hiding Refresh and Retry sync), the rate-limit time and its "Sync should resume shortly" fallback (U7), and the project-header repository hints.
- **Re-reading.** With a fake clock: the 2 s, 5 s and 10 s re-reads after a `202`, the early stop on a later `lastSyncedAt` or a different `states`, the quiet stop after the third read, the same rule after saving or closing a linked non-`gone` issue, `alreadyFresh` with no re-read, Retry sync `200` with no re-read, the Refresh project notice (`enqueued`, `skippedFresh`) and its single re-read, the 30 s focus throttle, and timers cleared on navigation.
- **Empty, loading and error states.** Each loading text, the Retry alert, "not found" for `404` and malformed ids (U1), each empty-state row, each override of the error map (including the "Try again in N s" countdown for the three rate-limit codes), client-side validation limits, and `ApiError.meta` (`undefined` when absent).
- **`ConfirmModal`.** Initial focus on Cancel, the confirm button on the right and named for the action, the typed confirmation, the in-flight state, and the error inside the modal.
- **UI edge cases.** U1 to U11 each have a spec; for U10 the focus re-read and banner, and for U11 the dirty-form prompt (`ConfirmModal`, restored hash, `beforeunload`).
- **Security.** S1 as a static spec (no `dangerouslySetInnerHTML` in the Issues components; titles, names and descriptions rendered as text) with the unit specs of [security.md](security.md#required-tests); S2 (the `https://github.com/` check, `rel` and `target`); S3 as a unit check (non-uuid ids show "not found" with no call, path segments encoded, a crafted hash such as `#/projects/..%2Fadmin` cannot change the path); S4 (no `localStorage` or `sessionStorage` writes of drafts); S5 (no integration or credential data on screen). P5: `IssueBody` is lazy-loaded with the `<pre>` fallback.
- **API in #507.** The open-issue count on project rows, the bulk selection (page-limited, cleared on page, filter or search change), "Close selected" and "Reopen selected", and the summary notice are specified here and tested when #507 lands.

## Pages

- [Screens and flows](ui/screens-and-flows.md): read when changing routes, the creation flows, project management, the lists, or the issue page and its forms.
- [Linking and sync](ui/linking-and-sync.md): read when changing the import, attach or unlink flows, the link panel and its state table, or the bounded re-reads after a trigger.
- [States](ui/states.md): read when changing empty, loading or error states, the error-message map, confirmations, the v1 scope (including bulk actions) or the U-numbered edge cases.
- [Decisions](ui/decisions.md): read for rejected alternatives, backward compatibility with the existing UI, and the performance and security rules (S1 to S5, P1 to P5).
