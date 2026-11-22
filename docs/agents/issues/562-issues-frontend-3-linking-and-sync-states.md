# Issue: Issues: frontend 3 (linking and sync states)

## Description

This issue is part of epic #483 (Issues and Projects). Kerghan gets **projects**, each optionally connected to one repository. It also gets **issues** that belong to a project and may be linked one to one to a GitHub issue. Background workers keep each linked pair in sync both ways. The specs define the feature in `docs/agents/specs/issues.md` and `docs/agents/specs/issues/*.md`, and the lifecycle is in `docs/agents/specs.md`. The specification phase is finished.

This issue builds the third part of the **UI**: the GitHub link panel, the import, attach and unlink flows, the link and sync state views, the trigger actions (Refresh, Retry sync, Refresh project) with their bounded re-reads, and the focus re-reads. The specs are the source of truth, and this issue makes no product decision of its own. If a decision has to change, the same PR updates the spec (`docs/agents/specs.md`, lifecycle step 2). #492 spawned the implementation issues.

## Builds against

- `docs/agents/specs/issues.md` (the index)
- `docs/agents/specs/issues/ui.md#required-tests` (Linking, States, Re-reading, and the U3, U7 and U10 rows of UI edge cases)
- `docs/agents/specs/issues/ui/linking-and-sync.md` (linking flows, link and sync states, re-reading after a trigger)
- `docs/agents/specs/issues/ui/screens-and-flows.md#lists` (the project header's actions and repository status)
- `docs/agents/specs/issues/ui/states.md` (the error-message map, `ConfirmModal`, the empty-state "Import from GitHub" action, U3, U7 and U10)
- `docs/agents/specs/issues/ui/decisions.md` (P4: bounded re-reads and the 30 s focus throttle; S2)
- `docs/agents/specs/issues/api/github-link.md` (import, attach, unlink, the link object and the trigger routes T2, T3 and T4)
- `docs/agents/specs/issues/edge-cases.md`: E1, E2, E17 to E21 (the states the UI words) and E61, E63, E64 (the flows)
- `docs/agents/specs/issues/security.md#github-and-user-content` (nothing GitHub-sourced is rendered as HTML; `meta.differences` names fields only)
- `docs/agents/specs/issues/testing.md#frontend-tests`

## Depends on

- #557 (Issues: GitHub link), merged
- #558 (Issues: sync workers), merged
- #561 (Issues: frontend 2), merged

## What already exists (reuse, do not redo)

#560 and #561 shipped these. Paths are under `frontend/assets/js/` unless they start with `frontend/specs/`.

- **Client:** `client/IssuesClient.js` already has `import`, `attach`, `unlink`, `refresh` and `retrySync`, and `client/ProjectsClient.js` has `refresh` (T3). Use them as is.
- **Error map:** `components/resources/projects/errors/errorMessages.js` already handles `PROJECT_REPOSITORY_CHANGED`, `GITHUB_UNAVAILABLE`, the three rate-limit codes and `VALIDATION_FAILED`. This issue adds `GITHUB_ISSUE_ALREADY_LINKED` (with the link to `meta.projectId`/`meta.issueId`) and `GITHUB_CREDENTIAL_UNUSABLE` (the reason sentence of the state table plus "Fix it in Integrations").
- **Shared pieces:** `components/common/confirmModal/ConfirmModal.jsx`, `components/common/forms/RateLimitCountdownController.js` (wired to the link modals here), the dirty-form guard, `utils/ids/uuid.js`, and the countdown ticker pattern of `repositories/pages/repositories/RefreshCountdown.js`.
- **Link pieces:** `components/resources/issues/link/LinkStateBadge.jsx` (the badge wording and variants) and `link/GithubLink.jsx` (the `https://github.com/` check, `rel` and `target`).
- **Issue page:** `issues/pages/show/IssueLinkPanelSlotHelper.jsx` is the empty slot between the header and the body, where the link panel goes. `IssueActionsController.js` handles Close and Reopen. `pages/common/IssueLoadController.js` loads the issue.
- **Project page:** `projects/pages/show/ProjectHeaderHelper.jsx` (today: name, "New issue", "Edit", description, `RepositoryLabel`) and the issue list under `issues/list/` (with its empty states).
- **Specs:** `frontend/specs/support/issuesBuilders.js`, `fetchSequence.js`, `fakeWindow.js`, and the security static spec `frontend/specs/assets/js/components/resources/projects/securityStaticSpec.js`.

## Task

- **Shared issue-number input.** It accepts `12`, `#12` or `https://github.com/<owner>/<name>/issues/12`, and only the number is sent:
  - a URL whose `owner/name` differs from the project's repository (case-insensitive) is rejected client-side with "This issue is not in <owner/name>"
  - anything else that cannot be parsed is rejected with "Enter an issue number or GitHub issue URL"
- **Import** ("Import from GitHub"), in a react-bootstrap modal. It is shown in the project header and in the Open and All empty states of the issue list, only when the project has a repository.
  - `201` closes the modal and navigates to the new issue's page.
  - `GITHUB_ISSUE_ALREADY_LINKED` shows "This GitHub issue is already linked" with a link to the existing issue.
  - Errors show inside the modal and keep the typed value. Submit shows a spinner and is disabled in flight (U2).
- **Attach** ("Link to a GitHub issue"), in the link panel of an unlinked issue, in its own modal:
  - The first call is sent without `confirmUpdatedAt`. A `200` closes the modal and shows the updated issue.
  - `ISSUE_ATTACH_CONFIRMATION_REQUIRED` turns the modal into a warning that names the fields of `meta.differences` (names only), for example "GitHub's title and body will replace this issue's title and body.". "Replace and link" retries with `confirmUpdatedAt = meta.updatedAt`, and Cancel closes the modal with nothing changed.
  - A second `409` on the retry shows the warning again with the new differences (E61).
  - `GITHUB_ISSUE_ALREADY_LINKED` behaves as on import. `ISSUE_ALREADY_LINKED` closes the modal and re-reads the issue (U3).
- **Unlink** ("Unlink", in every link state, including while the repository is Unavailable):
  - It calls `unlink.json` directly, with no confirmation.
  - `ISSUE_UNLINK_HAS_UNSENT_CHANGES` opens `ConfirmModal` ("This issue has changes not yet sent to GitHub. Unlinking discards them.", "Unlink and discard"). Confirming retries with `discardUnsentChanges: true` (E63).
  - `ISSUE_NOT_LINKED` counts as done (E64, U3).
  - After success, the panel shows the issue as unlinked.
- **Link panel** in the slot of the issue page:
  - **Unlinked:** "Not linked to GitHub", plus "Link to a GitHub issue" only when the project has a repository whose status is not Unavailable. Otherwise it shows a muted "Connect a repository to link issues" or "The project's repository is unavailable".
  - **Linked:** the primary-state badge (`LinkStateBadge`), `#N` through `GithubLink`, the panel message of every row of the state table (E1, E2, E17 to E21), and the actions. "Fix it in Integrations" links to `#/account/integrations`. The three credential reasons are visibly distinct from `retries_exhausted`.
  - **Secondary states:** the rest of `states`, as smaller lines under the primary message.
  - **"Last synced X ago":** shown for every linked, non-`gone` state, with "(may be out of date)" when `stale` is true.
  - **Rate-limit time:** local time plus relative ("sync resumes at HH:MM (in N min)"), refreshed by a ticker. A past or missing time reads "Sync should resume shortly." (U7).
  - **Action rules,** derived from `states`: a `gone` link gets Unlink only. With `repository_unavailable` anywhere in `states` there is no Refresh and no Retry sync. `sync_failed` gets Retry sync and never Refresh. Every other state gets Refresh. Unlink is always offered.
- **Triggers and bounded re-reads** (with a fake clock in the specs):
  - **Refresh (T2) or Retry sync (T4) answering `202`:** re-read `show.json` about 2 s, 5 s and 10 s after the response. Stop early when `lastSyncedAt` is later than at the trigger or `states` differs from the trigger's response. The button reads "Refreshing…" or "Retrying…" and is disabled meanwhile. After the third read it stops quietly.
  - **Refresh answering `200 alreadyFresh`:** a short "Already up to date" notice, with no re-read. **Retry sync answering `200`:** show the returned issue, with no re-read.
  - **After saving an edit, or Close/Reopen, on a linked non-`gone` issue:** the same bounded re-read runs on the issue page. A save from the edit form hands the saved issue to the issue page through a one-shot, in-memory signal: the form records the issue id and the edit response, and the issue page consumes it once on load and starts the re-read. The URL does not change, a reload does not repeat it, and nothing goes to storage (S4).
  - **Refresh project (T3),** in the project header and only with a repository: the notice "Refreshing N issues (M already up to date)", or "Everything is up to date" when `enqueued` is 0, then one re-read of the current list page about 10 s later. The button is disabled until then.
  - **Window focus:** the issue page and the project page re-read when the window regains focus, at most once every 30 s (P4).
  - **Timers** are cleared when the user navigates away.
- **Project header:** "Import from GitHub" and "Refresh project" (only with a repository), and the repository status hints. Added shows no hint. Unavailable shows "Unavailable: sync and linking are paused" with a link to `#/repositories`. Unknown shows "Unknown: not seen in the last repository sync".
- **U10 on the edit form:** the form keeps the `updatedAt` it loaded. On window focus (throttled to 30 s) it re-reads the issue without touching the fields. If `updatedAt` is newer, it shows the banner "This issue changed since you opened it" with "Discard my changes and reload". Save stays allowed.
- **Security static spec:** extend `securityStaticSpec.js` to the link panel and the modals (no `dangerouslySetInnerHTML` or `innerHTML`, and no storage writes).
- **Docs:** update `docs/agents/architecture/frontend.md` (the link panel, the modals, the re-read scheduler and the focus re-reads).

## Out of scope

- The open-issue count on project rows, and bulk close and reopen: #563.
- Live updates beyond the bounded re-reads (no background poll).

## Acceptance criteria

- Every Required test in `ui.md#required-tests` that falls in this scope is implemented, on the tier given by [`testing.md`](https://github.com/darthjee/kerghan/blob/main/docs/agents/specs/issues/testing.md). That covers:
  - Linking (input parsing, import, attach with the warning and E61, `ISSUE_ALREADY_LINKED`, unlink with E63 and E64)
  - States (every row of the state table with E1, E2, E17 to E21, secondary states, "last synced" and the stale hint, every action rule, the rate-limit time and U7, and the project-header repository hints)
  - Re-reading (every rule above, with a fake clock)
  - the `GITHUB_ISSUE_ALREADY_LINKED` and `GITHUB_CREDENTIAL_UNUSABLE` error-map overrides, and the "Try again in N s" countdown in the link modals
  - U2 on every new action button, and U3, U7 and U10
  - S2 on the panel's `#N` link
- Frontend specs that cover an edge case carry its E-id or U-id, so the backend `edge-cases.coverage.spec.ts` sweep finds them.
- No decision differs from the specs. If one has to, the same PR updates the spec. The same PR also aligns the #562 row of the implementation table in `docs/agents/specs/issues.md` with the *Builds against* list above.
- The frontend checks pass:
  - `docker-compose run kerghan_fe yarn coverage`
  - `docker-compose run kerghan_fe yarn lint`

## Notes

- **Responsible agent:** `frontend`.
- **Review:** `security`, for the `#N` link (S2), the attach warning (field names only, never GitHub content), and the ids in paths and links (S3).
