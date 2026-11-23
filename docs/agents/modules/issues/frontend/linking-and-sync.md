# Issues and Projects UI — Linking and sync

The import, attach and unlink flows, the link panel and every link and sync state, and the bounded re-reads after a trigger. Back to the [Issues and Projects UI](../frontend.md) hub.

## Linking flows

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

## Link and sync states

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
- The **list rows** use the same badge labels for their primary-state badge (see [Lists](screens-and-flows.md#lists)).
- **Project header** repository status: Added shows no hint; Unavailable shows "Unavailable: sync and linking are paused" with a link to `#/repositories`; Unknown shows "Unknown: not seen in the last repository sync" and linking still works.
- The URL accepted by the link modals is parsed client-side only; the API still receives just the number, so the rejected "URL as identifier" alternative of [github-link.md](../github-link.md#not-decided) stands.

## Re-reading after a trigger

The API exposes no "syncing" state, so the UI re-reads. Sync itself stays on demand: these are bounded client-side re-reads after a user action, never a background poll, and a read never enqueues a job.

- **Issue Refresh (T2) answering `202`, and Retry sync (T4) answering `202`:** re-read `show.json` at about 2 s, 5 s and 10 s after the response. Stop early as soon as `lastSyncedAt` is later than at the trigger, or `states` differs from the trigger's response. Meanwhile the button reads "Refreshing…" (or "Retrying…") and is disabled. After the third read it stops quietly; the panel already shows the current state.
- **The same bounded re-read** runs after saving an edit (or Close/Reopen) on a linked, non-`gone` issue, so *Pending* turns into *Synced* (or a failure) without a reload.
- **Issue Refresh answering `200 alreadyFresh`:** a short "Already up to date" notice, no re-read.
- **Retry sync answering `200`** (no-op): show the returned issue, no re-read.
- **Refresh project (T3, `202`):** a notice "Refreshing N issues (M already up to date)" from `enqueued` and `skippedFresh`, or "Everything is up to date" when `enqueued` is 0; then one re-read of the current list page about 10 s later. The button is disabled until then.
- **Window focus:** the issue page and the project page re-read when the window regains focus (as the awaiting-approval view does), at most once every 30 s.
- Timers are cleared when the user navigates away.

