# Issues and Projects — Sync and workers

Two-way sync between a Kerghan issue and its linked GitHub issue.
Part of the [Issues and Projects specs](../issues.md).

Settled rules that frame everything below:

- Sync is two-way, on demand only (no timer, no polling), and built on the in-process, in-memory queues of `WorkersService` (`register` / `enqueue`, [workers module](../../modules/workers.md)); #479 is done.
- Outbound writes use a durable pending marker in the database, re-enqueued at boot, so a restart does not lose a pending write ([model.md](model.md#issues_pending_writes-the-pending-marker)).
- Jobs receive ids only. Credentials stay in the Integrations module and never appear in job params or logs.
- Sync is refused while the project's repository is Unavailable and allowed while it is Unknown; pending writes stay in their markers ([projects.md](projects.md#linked-repository-unavailable-or-removed)).
- Creating a project and attaching a repository never sync or enqueue a job ([projects.md](projects.md#creation-paths)).
- A queued or in-flight job for a deleted project or user is a no-op (no error, no retry), and deleting a project discards its markers ([projects.md](projects.md#deletion)).
- GitHub work uses the project owner's integrations, whoever triggers it ([projects.md](projects.md#room-for-sharing-members-and-roles)).
- A gone link creates no marker and gets no push or refresh; it is left only by unlinking ([github-link.md](github-link.md#gone-transferred-and-repository-unreachable)).
- Reads and writes of a linked issue address the repository by owner and name as in [github-link.md](github-link.md); a `301` is handled as stated there.
- Link states: `linked`, `gone` and `sync_failed` (with a reason) are stored; pending, rate limited and repository unavailable are derived, with the precedence of [github-link.md](github-link.md#link-states). `paused` is not a link state.
- Outcomes of the edge cases are fixed in [edge-cases.md](edge-cases.md); the mechanics are in this file.

## Fields and ownership

- **Synced fields:** `title`, `body` and `state`, all three **two-way**. No side owns a field outright: either side may change any of them, and conflicts are settled per field by E6 to E11 (base snapshot plus newest timestamp per field).
- **`state_reason` is not synced (accepted loss, v1).** A push never sends `state_reason`. A push carries only changed fields, so an edit of the title or body leaves a GitHub "not planned" close untouched; a close pushed from Kerghan gets GitHub's default reason (`completed`), and a reopen gets GitHub's default too. This settles E55 ([model.md](model.md#edge-cases)) as a documented known limitation; storing `state_reason` is a follow-up with no owner issue yet.
- **The push payload is a diff.** The `PATCH` carries only the fields whose current local value differs from the base snapshot (after the conflict rules drop the fields GitHub wins). A push with an empty diff makes no call and clears the marker (E8).
- **Values are verbatim (normalization invariant).** Inbound values are stored exactly as GitHub returns them, except a blank body, which is stored as `NULL`. Comparisons (local vs base, base vs remote) treat `NULL` and `''` as equal and apply no other normalization (no CRLF or whitespace rewriting), so what Kerghan stores matches GitHub byte for byte. One function produces the stored values, the base snapshot and the operands of every "values differ" test.
- Title and body limits match GitHub's (256 and 65536 characters), so an inbound value never needs truncation.

## Reconcile

Every sync job runs the same **reconcile** of one link. An inbound refresh is a reconcile with no marker; a refresh of a link that has a marker also pushes (the marker already means a push is wanted). One code path, one set of E6 to E11 tests.

1. **Read the marker** (revision `R`, its `updated_at` `Tm`, or none), the issue's local values (L) and the base snapshot (B).
2. **Read GitHub first, always**, with a conditional `GET` (`If-None-Match` with the stored `etag`). A `304` means GitHub equals the base for all three fields (G = B). A blind `PATCH` is rejected: E6 and E7 need GitHub's current values.
3. **Merge per field** (title, body, state):

   | L vs B | G vs B | Outcome |
   |---|---|---|
   | equal | equal | Nothing. |
   | equal | differs | Pull: local and base take G. |
   | differs | equal | Push L. |
   | differs | differs, L = G | E8: base takes L, no push for the field. |
   | differs | differs, L ≠ G | E7: if `Tm` ≥ G's `updated_at` (a tie goes to Kerghan), push L; otherwise pull G (local and base take G) and drop the field from the push. |

4. **Push** a `PATCH` with only the fields left to push (empty diff: no call).
5. **Commit** in one transaction, in lock order (projects, issues, links, markers):
   - the base takes the pushed values;
   - `github_updated_at` takes the `PATCH` response's `updated_at` (or the `GET`'s when nothing was pushed) and `last_synced_at` is set;
   - the pulled fields are written to the issue and to the base **only if the marker revision is still `R`** (or still absent);
   - the marker is deleted `WHERE link_id = ? AND revision = R` (compare-and-clear).
6. **Revision changed during the job** (E10, E41): only the push effects are committed (base of the pushed fields, timestamps). The pulled fields are skipped entirely, **neither local nor base** is touched, and the job is enqueued again (T6); the next reconcile re-reads GitHub and sees them again as a pull or a conflict. Updating the base without the local value would make the next run push the stale local value over GitHub's change. The marker revision is per link, so any edit skips all pulled fields; this adds no loss beyond E7's accepted per-issue timestamp limitation.

- **Ping-pong (E11).** A pull never creates a marker, and the base takes the pushed values together with the `PATCH`'s `updated_at`, so GitHub's own bump after our push is not seen as a remote change.
- **ETag from `GET` only.** The `etag` is stored from each `200` `GET` and set to `NULL` after a `PATCH`, so the read after a push is a full `GET`. No assumption is made that a `PATCH` response's ETag matches a later `GET`.

## Triggers

Every trigger enqueues the same reconcile job with a link id. No trigger fires for a `gone` link (E1). Triggers stay on demand: no timer or polling.

| # | Event | Enqueues |
|---|---|---|
| T1 | A local edit that changes a synced field of a linked issue | The marker upsert (same transaction as the edit), then one reconcile, enqueued **after the commit** so the job never reads uncommitted rows. A crash between commit and enqueue is covered by T5. Enqueued through the mandatory per-link dedupe ([below](#queued-jobs-are-deduplicated-per-link)); duplicates across instances are harmless by E13 (a later job finds no marker and costs at most a `304` `GET`). |
| T2 | The user's manual refresh of one issue | One reconcile, with or without a marker. |
| T3 | The user's manual refresh of a project | One reconcile per non-`gone` link of the project's issues, oldest `last_synced_at` first (never-synced first). The burst is governed by the rate-limit rules. |
| T4 | The user's manual "retry sync" on a link | One reconcile (state transitions are in [Retries and `sync_failed`](#retries-and-sync_failed)). |
| T5 | Boot | One reconcile per marker, oldest `marked_at` first. |
| T6 | A reconcile whose compare-and-clear deletes no row (the revision changed) | The same reconcile again. |

- <a id="queued-jobs-are-deduplicated-per-link"></a>**Mandatory per-link dedupe.** While a reconcile for a link is queued and not yet started, enqueuing the same link again is a no-op. The link leaves the queued set when its job starts, so an edit during a running job still enqueues the next one (T6 is unaffected). Every trigger (T1 to T6) and the rate-limit timer go through it, so the in-memory queue holds at most one waiting job per link. Per process, lost on restart; correctness never depends on it (E13). Decided in [security.md](security.md#queued-jobs-are-deduplicated-per-link).
- **No approval trigger (E24).** `denied` is final in [user-approval](../../modules/auth/user-approval.md) (approve only moves `pending` to `approved`; there is no un-deny), and `authorization-request.approved` is login authorization, not account approval. So no listener re-enqueues a user's markers: they stay until the user is deleted, and boot or retry jobs stop at the approval guard with no call. A future un-deny feature must re-enqueue the user's markers itself.
- **No trigger** for link creation or attach (the request already reads GitHub, E61), unlinking, `gone`, a repository change, or fixing or adding an integration (E19: fixing the integration does not push by itself; the user retries).
- Routes and payloads for T2 to T4 are decided in [api.md](api/github-link.md#trigger-routes); wording and placement are in [ui.md](ui.md#link-and-sync-states).

## Job

- **One job, `issues.reconcile`**, registered by the Issues module on init through `WorkersService.register`, with the issues sync service injected as an attribute. Params are **`{ linkId }` only** (no user id, content or credential). Push and refresh are the same job.
- **Thin job.** `perform()` calls the sync service's `reconcile(linkId, { lastAttempt })` and maps its outcome:

  | Outcome | Job |
  |---|---|
  | `done` | Finishes cleanly. |
  | `requeue` (compare-and-clear missed, T6) | Enqueues a fresh `issues.reconcile` (fresh attempts), then finishes. |
  | `stopped` (no-op, `gone`, credential reasons, `forbidden`, user not approved, repository Unavailable) | Finishes cleanly; the service has already written any state. No retry. |
  | `transient` (`5xx`, timeout, network error, unclassifiable `301`) | `_fail`, so the engine retries after its cooldown. On the last attempt the service instead sets `sync_failed` with reason `retries_exhausted` and the job finishes cleanly. |
  | `rate_limited(until)` | Finishes cleanly, never `_fail` (E17): the link waits for the integration's reset ([Rate limits](#rate-limits)). |

- **Exhaustion is detected by the job's own counter.** `deku-swarm` dead-letters an exhausted job with no hook, so the job instance keeps a private attempt counter, incremented at the start of each `perform()` (the same instance is reused across retries), and passes `lastAttempt = attempts >= maxRetries` to the service. No reliance on library internals; the `(engine)` spec verifies it against the real `deku-swarm`.
- **Guard order** inside `reconcile`, before any GitHub call:
  1. The link exists, is not `gone`, and its project is live. Otherwise a silent no-op (E32, E40, E1).
  2. The project owner is `approved`. Otherwise stopped, no call, marker kept (E24).
  3. The project's repository is not Unavailable (Unknown is allowed). Otherwise stopped, no call, marker kept, no retry; the derived "repository unavailable" state shows and the next trigger tries again (E26).
  4. At least one candidate integration resolves ([Integration selection](#integration-selection)). Otherwise `sync_failed` with `no_credential` (E20) or `credential_invalid`, no call.
  5. At least one candidate is not paused by a rate limit. Otherwise the link joins a waiting set, no call.
- **Idempotence** comes from guarded writes, compare-and-clear and a fixed-value `PATCH` (E13, E15); the job holds no state beyond its attempt counter, and correctness never depends on dedupe.
- **Logs** carry safe fields only, as listed in the table of [security.md](security.md#logs-and-job-params): `jobId`, `linkId`, the outcome kind and, on failure, the error class. Never a title, body, owner/name, URL, header or credential.

## Rate limits

- **Source of the delay.** The Integrations client answers `rate_limited` with `resetAt` (from `retry-after`, else `x-ratelimit-reset`; HTTP responses expose it as `retryAfterSeconds`). When it is `null` (typically a secondary limit) the pause is **60 seconds**, GitHub's recommended minimum.
- **Pause per integration.** An in-memory pause keyed by **integration id** (an id, never a credential) holds the reset time. GitHub limits per token or installation, so another integration of the same owner keeps working.
- **Waiting set and one timer per integration.** A reconcile that gets `rate_limited`, or finds its resolved integration paused (guard 5), adds its `linkId` to that integration's waiting set (deduplicated) and finishes cleanly, with no GitHub call while waiting. One timer per integration, driven by the injected `Clock` and scheduler, enqueues one `issues.reconcile` per waiting link at the reset, oldest marker first (links without a marker last), then clears the set. A later `rate_limited` answer re-arms the pause and the timer.
- **Waits never count toward the retry limit (E17).** A rate-limited job finishes instead of `_fail`, so its attempt counter is never consumed; the resumed job is fresh. A rate limit alone never sets `sync_failed` and never loses a write (the marker stays).
- **Derived state.** A link shows "rate limited until X" while it is in a waiting set; X is the integration's reset time. It is in memory only and never stored.
- **Restart.** Pauses and waiting sets are lost. Boot re-enqueues every marker (T5); the first call that hits the limit pauses again. A waiting refresh with no marker is lost and re-triggered by the user (E16).
- **No write pacing in v1.** The pool size (3) bounds concurrency; secondary limits are handled as `rate_limited` with the 60-second fallback.

## Retries and `sync_failed`

- **Retry values.** `issues.reconcile` overrides the `deku-swarm` getters on its class: **`maxRetries` 5 and `cooldown` 30 seconds** (a fixed cooldown; `deku-swarm` has no exponential backoff), about two minutes to ride out a short GitHub outage. They are read from `KERGHAN_ISSUES_SYNC_MAX_RETRIES` and `KERGHAN_ISSUES_SYNC_COOLDOWN_MS` ([Configuration](#configuration)), independent of the engine-wide `KERGHAN_WORKERS_*` values. Only transient failures (`5xx`, timeout, network error, unclassifiable `301`) consume attempts.
- **Set** (by any trigger, including a refresh with no marker; the latest reason overwrites an earlier one):

  | Reason | When |
  |---|---|
  | `retries_exhausted` | The last transient attempt fails (E18). |
  | `no_credential` | No integration resolves at all, or only a GitHub handle (E20). No call is made. |
  | `credential_invalid` | A `401` on any call (the Integrations module marks the integration `invalid`, E19), or the only candidates are integrations already not usable. |
  | `forbidden` | A non-rate-limit `403` on any call (E5, E21; reached in one attempt, no retry), or a `404` whose issues probe fails with `403` or `404` (access lost, E22). A probe failing with `401` is `credential_invalid`. |

- **Left** (back to `linked`, reason `NULL`) by:
  - a push whose compare-and-clear deletes the marker;
  - a successful reconcile when no marker exists (a refresh never clears a failure that belongs to an unsent write);
  - the **retry sync** action, which resets the status to `linked` at once and enqueues T4; the UI then shows the derived *pending* state, and the job sets the failure again if it still fails. Exception: while the repository is Unavailable (or dangling) the retry is refused with `409 PROJECT_REPOSITORY_UNAVAILABLE` before the reset, because the reset would clear the failure reason and the job would stop at the repository guard without setting a new one ([api.md](api/github-link.md#trigger-routes));
  - `gone`, which replaces it.
- An edit never writes a status; it only creates the marker and enqueues T1. `sync_failed` never blocks a job: every trigger still runs, and credential reasons stop at the guards with no call where they can.
- The reason set stays at the four values of [model.md](model.md#issues_github_links); no `access_lost` reason is added.

## Staleness

- **`last_synced_at`** is set by every successful reconcile and by link creation or attach (which read GitHub in the request, E61), so a link is never "never synced".
- **Stale** means `last_synced_at` is older than `KERGHAN_ISSUES_SYNC_STALE_AFTER_SECONDS` (default 3600). The backend derives a `stale` flag next to `lastSyncedAt` ([api.md](api/github-link.md#link-object) exposes both, [ui.md](ui.md#link-and-sync-states) words them). It is never stored and never a link state. A `gone` link is never reported stale.
- **Display only.** A stale link is shown as such ("last synced X ago" plus a stale hint) and the user refreshes it (T2 or T3). A read never enqueues a job, so every GET stays side-effect free; no auto-refresh on open or on the issue list.
- **Manual refresh skips fresh links.** T2 and T3 skip any link **without a marker** whose `last_synced_at` is under 60 seconds old; a single-issue refresh of such a link answers "already fresh" (`200` with `alreadyFresh: true`, [api.md](api/github-link.md#trigger-routes)). A link with a marker is never skipped, since it has a write to push. No cooldown state or `429` is needed.

## Integration selection

- **Candidates.** The project owner's **usable** integrations (`listUsableIntegrations`: `active` and type enabled) whose source lists the project's repository in `repositories_sources`, read through Repositories' exported service (never a join). A handle-only listing is not a candidate (E20). Resolved at job time; nothing in the feature stores an integration id ([model.md](model.md#cleanup)), and the owner's integrations are used whoever triggered the job.
- **None.** No candidate: `sync_failed` with `no_credential`, or `credential_invalid` when an integration lists the repository but is not usable (`expired`, `invalid`, `undecryptable`). No call is made.
- **Order.** By **known write capability**, oldest first within a group: (1) known writable: OAuth app, classic PAT, and a GitHub App whose recorded installation permissions have `issues: write`; (2) unknown: fine-grained PAT; (3) known read-only: a GitHub App whose recorded permissions have `issues: read`. The recorded permissions can be stale (an owner who accepts the update on GitHub is seen at the next test connection); this never causes a wrong outcome, because the credential-only fallback below moves to the next candidate on a `403`, and the aggregate reason stays `forbidden` only when every candidate refuses ([security.md](security.md#write-access-to-github)).
- **Fallback on credential failures only**, mirroring Repositories' sync: on a `401`, a non-rate-limit `403` or `integration_unusable`, the reconcile restarts from its `GET` with the next candidate, within the same attempt (a `401` still marks that integration `invalid`). A rate limit, timeout or `5xx` never falls back. When every candidate fails on credentials, the reason is `forbidden` if any answered a `403`, else `credential_invalid`.
- **Paused candidates are skipped.** When every candidate is paused, the link joins the waiting set of the one whose reset comes first.
- **The E22 probe** runs with the same candidate that got the `404`.
- Logs and job params never name which credential served a call beyond the integration id.

## Marker lifecycle

Complements the marker rules of [model.md](model.md#issues_pending_writes-the-pending-marker) (coalesced, no payload, compare-and-clear, boot oldest first, attempts in memory).

- **Creation.** An edit that changes a synced value creates or bumps the marker while the link is `linked` or `sync_failed`, including while the repository is Unavailable, the integration is rate limited or the user has no credential. Only `gone` blocks a marker (E1). `marked_at` is set only on insert; `updated_at` and `revision` move on every value-changing edit; both timestamps come from the injected `Clock`.
- **Commit guard.** The reconcile's commit locks the link and applies only if the link still exists and is not `gone`; otherwise it writes nothing (E1 race, E32).
- **Compare-and-clear miss.** Re-read the marker under the lock: if it still exists (its revision moved), enqueue again (T6); if it was deleted (unlink with confirmation, project or user deletion), finish with no new job.
- **Boot enqueues every marker**, oldest `marked_at` first, with no filtering: the guards stop markers of non-approved users, Unavailable repositories or missing credentials with no GitHub call, and one attempt per boot is an accepted recovery path (E18).
- **Markers never expire.** A marker lives until it is pushed, discarded by an unlink with confirmation (E63), removed by project or user deletion, or removed when the link becomes `gone`. An unsent write is never dropped silently; the link shows *pending* or `sync_failed` until then.
- **Several backend instances.** Correctness never assumes a single instance: each instance's boot re-enqueue produces duplicate jobs, which are harmless (E13). Rate-limit pauses and waiting sets are per instance (in memory).

## GitHub issue client operations

`getIssue` and `probeIssues` are added to `IntegrationsGithubService`, which stays `GET`-only; `updateIssue` lives on the separate exported `IntegrationsGithubIssueWriter`, injected only by the issues sync service ([security.md](security.md#the-integrations-boundary)). Both follow the existing service shape (`(userId, integrationId, …)`, `kind` unions sharing `RepoFailure` = `invalid_credentials | rate_limited{resetAt} | unavailable{reason} | integration_unusable{reason}`). `repo` is `{ owner, name }` from the repository row; `issue` is `{ id, number, title, body, state, updatedAt, isPullRequest }`.

| Operation | Success kinds | Issue-specific kinds (plus `RepoFailure`) |
|---|---|---|
| `getIssue(userId, integrationId, repo, number, etag?)` | `ok{issue, etag}`, `not_modified` | `not_found`, `gone` (`410`), `moved`, `forbidden` |
| `updateIssue(userId, integrationId, repo, number, changes)` | `ok{issue}` | `not_found`, `gone`, `moved`, `forbidden` |
| `probeIssues(userId, integrationId, repo)` | `ok` | `not_found`, `forbidden` |

- `changes` holds only the fields to push (`title?`, `body?`, `state?`); never `state_reason`. The writer rejects any other field before a call.
- **Token permissions per operation** (GitHub App): `getIssue` and `probeIssues` mint `{ issues: read, metadata: read }`, `updateIssue` mints `{ issues: write }`; the token cache is keyed by installation and permission set ([security.md](security.md#the-github-app-gains-issues-write)).
- **Redirect host check.** No client follows a redirect automatically. A rename is followed once only when the `Location` is `https://api.github.com/` in the rename form; any other scheme, host, port or path shape is unclassifiable: not followed, no credential sent, outcome `transient` (E65). This applies to `updateIssue` too.
- `renamed` stays adapter-internal: the client retries once at the `Location` and returns the result with a `renamedTo` hint, which the caller hands to Repositories (E65).
- **`forbidden` is its own kind** (a non-rate-limit `403`) for issue operations, rather than `unavailable{reason:'forbidden'}`, so the sync tells E5 and E21 apart from transient failures without inspecting reasons.
- Listing for import is not part of this spec (link creation, #487 and [api.md](api.md)).

## Configuration

| Key | Default | Validation |
|---|---|---|
| `KERGHAN_ISSUES_SYNC_MAX_RETRIES` | 5 | Positive integer; otherwise the default. |
| `KERGHAN_ISSUES_SYNC_COOLDOWN_MS` | 30000 | Positive integer; otherwise the default. |
| `KERGHAN_ISSUES_SYNC_STALE_AFTER_SECONDS` | 3600 | Positive integer; otherwise the default. |
| `KERGHAN_ISSUES_MAX_PROJECTS_PER_USER` | 100 | Positive integer; otherwise the default. |
| `KERGHAN_ISSUES_MAX_ISSUES_PER_PROJECT` | 5000 | Positive integer; otherwise the default. |
| `KERGHAN_ISSUES_LINK_MAX_PER_WINDOW` | 30 | Positive integer; otherwise the default. |
| `KERGHAN_ISSUES_LINK_WINDOW_MS` | 60000 | Positive integer; otherwise the default. |
| `KERGHAN_ISSUES_EDIT_MAX_PER_WINDOW` | 120 | Positive integer; otherwise the default. |
| `KERGHAN_ISSUES_EDIT_WINDOW_MS` | 60000 | Positive integer; otherwise the default. |

The last six are the caps and request rate limits decided in [security.md](security.md#quotas-and-abuse-limits).

`environment-variables.md` and `modules/workers.md` describe what the code does today, so the implementation issue adds these keys and the `issues.reconcile` job (with its per-class retry override) to them in the same change that reads them.

## Alternatives considered

- **A blind `PATCH` without reading GitHub first:** rejected, E6 and E7 need GitHub's current values.
- **Separate push and refresh jobs:** rejected for one reconcile algorithm and one set of tests.
- **A full `PATCH` of every field:** rejected for a diff, so unrelated GitHub edits and `state_reason` are not overwritten.
- **Storing `state_reason`:** deferred as a follow-up; accepted loss in v1.
- **CRLF or whitespace normalization:** rejected, values stay byte for byte.
- **`exhausted()` from the library, or marking `sync_failed` on every failure:** rejected for the job's own attempt counter, which relies on no library internals.
- **A per-user pause, or per-job timers:** rejected for a pause per integration id and one timer per integration with a waiting set.
- **No auto-resume after a rate limit:** rejected; the timer resumes waiting links.
- **Write pacing:** deferred until secondary limits show up in practice.
- **Engine-default retries (3, 5 s):** rejected for 5 and 30 s, which ride out a short outage.
- **An `access_lost` reason:** rejected; access loss is `forbidden` or `credential_invalid`.
- **Keeping `sync_failed` until success on retry:** rejected; retry resets to `linked` at once and the job sets the failure again if needed.
- **Auto-refresh on open, or a `429` cooldown on project refresh:** rejected; reads stay side-effect free and fresh marker-less links are skipped.
- **Any usable integration as candidate:** rejected; only those listing the repository.
- **No fallback between integrations:** rejected for credential-only fallback.
- **Filtering markers at boot, or expiring markers:** rejected; guards stop them with no call and an unsent write is never dropped silently.
- **An approval listener that resumes markers:** rejected; `denied` is final (E24).

## Open questions

Owned elsewhere; none is owned by #488.

- [x] Routes and payloads of refresh, retry sync and the exposed `lastSyncedAt`/`stale` fields: decided in [api.md](api.md) (#489).
- [x] Wording and placement of the stale hint and states: decided in [ui.md](ui.md#link-and-sync-states) (#491).
- [x] Whether the GitHub App gets issue write permission: decided in [security.md](security.md#the-github-app-gains-issues-write) (#490): Issues: write, with per-operation tokens.
- [ ] Per-field timestamps (E7 uses one per-issue timestamp): accepted limitation, no owner issue.

## Required tests

Tiers, fixtures and tags: [testing.md](testing.md).

- **Fields.** The `PATCH` carries only the diff and never `state_reason` (unit); an empty diff makes no call and clears the marker (E8); `NULL` equals `''`, a blank body is stored as `NULL`, and no other normalization is applied.
- **Reconcile table.** Every row of the L/B/G table, E7 for Kerghan newer, GitHub newer and tie (unit); a `304` is G = B; the etag is stored from a `GET` and cleared after a `PATCH`; a push followed by a refresh creates no marker and no further push (E11).
- **Races `(race)`.** Edit during a refresh skips all pulled fields and re-enqueues (E10, E41); compare-and-clear miss re-reads the marker (re-enqueue when it exists, nothing when deleted); duplicate jobs (E13); crash before the clear (E15); the commit guard for a link gone or deleted mid-job (E1, E32, E44).
- **Triggers.** An edit enqueues after commit; manual refreshes and retry sync enqueue; project refresh orders by oldest `last_synced_at`; link creation, unlink, repository change and integration fixes enqueue nothing; a restart re-enqueues every marker oldest first `(db)` (E16).
- **Job.** Outcome mapping per row of the table; a transient failure retries with the issues retry config and exhaustion sets `retries_exhausted` through the job's own attempt counter `(engine)`; a rate-limited job finishes without `_fail`; params are `{ linkId }` only and logs carry only the allowlisted fields (the canary sweep of [testing.md](testing.md#security-verification)).
- **Guards.** A deleted project or user, a gone link, a non-approved user (no call and no listener, E24), an Unavailable repository (no call, marker kept) and an Unknown repository (allowed).
- **Rate limits** (with `FakeClock` and the injected scheduler). No call while paused; one enqueue per waiting link at the reset, oldest marker first; the 60-second fallback; waits never consume attempts and never set `sync_failed` (E17); a pause on one integration leaves another working.
- **`sync_failed`.** Each reason is set by its trigger (E18 to E22) and each exit (clearing push, refresh with no marker, retry sync resetting to `linked` at once, `gone`); a retry while the repository is Unavailable is refused and keeps the reason; a refresh never clears a failure with an unsent marker; `sync_failed` never blocks a job.
- **Integration selection.** Candidates, order by the three write-capability groups (a stale App record corrected by the `403` fallback), credential-only fallback restarting from the `GET`, the aggregate reason, paused candidates skipped, handle-only is no candidate (E20) and the probe uses the same candidate.
- **Staleness.** The stale flag at the threshold, never for `gone`, reads never enqueue, and the 60-second fresh skip (never for a link with a marker).
- **Client.** `getIssue`, `updateIssue` and `probeIssues` map each kind of the table, with `renamed` handled inside the adapter; a `301` to another host, scheme or port is not followed and sends no credential.
- **Dedupe.** Enqueuing a queued link is a no-op; an edit during a running job enqueues once more; a burst of edits leaves one waiting job.
