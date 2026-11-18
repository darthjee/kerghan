# Update sync.md and github-link.md

**sync.md**

- Integration selection "Order": replace "write-capable types first (PAT and OAuth app before GitHub App, which is read-only until #490 decides)" with the three groups by known write capability (known writable, unknown, known read-only), oldest first within a group, and the note that a stale App record is corrected by the `403` fallback.
- GitHub issue client operations: `updateIssue` moves to `IntegrationsGithubIssueWriter`; note per-operation token permissions; result kinds unchanged.
- Redirects: an unclassifiable `Location` includes another scheme, host or port; it is not followed and carries no credential.
- Triggers: T1's "no dedupe" becomes the mandatory per-link dedupe (a link queued and not yet started is not enqueued again; it leaves the set when the job starts); every trigger and the rate-limit timer go through it; correctness still does not depend on it (E13).
- Configuration: add `KERGHAN_ISSUES_MAX_PROJECTS_PER_USER` (100), `KERGHAN_ISSUES_MAX_ISSUES_PER_PROJECT` (5000), `KERGHAN_ISSUES_LINK_MAX_PER_WINDOW` (30), `KERGHAN_ISSUES_LINK_WINDOW_MS` (60000), `KERGHAN_ISSUES_EDIT_MAX_PER_WINDOW` (120), `KERGHAN_ISSUES_EDIT_WINDOW_MS` (60000), same validation as the existing keys. If they read better in `security.md` or `api.md`, keep one table and link to it.
- Job "Logs": point to the log table of `security.md`.
- Open questions: close "Whether the GitHub App gets issue write permission".
- Required tests: candidate order by group, dedupe, redirect host check.

**github-link.md**

- "The GitHub App is registered with Issues: read…" becomes Issues: write; an installation that has not accepted the update still reads and its pushes end `forbidden`.
- Addressing: an unclassifiable `Location` explicitly includes another host.
- Open questions: close "Rendering of GitHub content" (decided in `security.md`).

## Files to Change

- `docs/agents/specs/issues/sync.md` — candidate order, writer, redirects, dedupe, configuration, open question.
- `docs/agents/specs/issues/github-link.md` — App permission, redirect host, open question.
