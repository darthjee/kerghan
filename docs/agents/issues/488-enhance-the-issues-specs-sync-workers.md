# Issue: Enhance the Issues specs: sync workers

## Description

This is part of the epic #483 (Issues and Projects): Kerghan gets **projects** (optionally connected to one repository) and **issues** that belong to a project and may be linked one to one to a GitHub issue, kept in sync both ways by background workers. The feature is first defined as specs under `docs/agents/specs/issues.md` and `docs/agents/specs/issues/*.md` (the lifecycle is in `docs/agents/specs.md`). This issue is documentation only: no code, migrations or endpoints.

### Task

Enhance `docs/agents/specs/issues/sync.md` (created by the first sub-issue of the epic): resolve its open questions, fill gaps and make it precise enough for an implementation issue to build against without making its own decisions.

Focus:
- Which fields sync each way, and which side owns each field.
- Conflict rules when both sides changed.
- Triggers (on demand only for now): the exact events that enqueue a job.
- Job design on the #479 infrastructure (`WorkersService.register` and `enqueue`): job names, parameters (ids only), idempotence.
- The durable pending marker: how it is set, pushed, cleared and re-enqueued at boot.
- Rate limits and failures: reuse of `retryAfterSeconds`, retry and cooldown, the failed state and how a later run recovers.
- Staleness: when a sync is considered out of date.
- A user without a write-capable credential: how the link is shown and behaves (read-only).
- Credentials stay in the Integrations module; jobs receive ids, never secrets; logs carry safe fields only.

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

Responsible agent: `architect`. This is the most open spec and the largest of the enhancement issues. The workers infrastructure from #479 is done (`WorkersService`, `docs/agents/modules/workers.md`), so the sync implementation is no longer blocked on it.

## Problem

`docs/agents/specs/issues/sync.md` fixes most outcomes (E6 to E24) but leaves the mechanics open: five open questions (synced fields, conflict mechanics, `sync_failed` reasons and transitions, staleness, retry values and integration selection), the job design on `WorkersService`, and the GitHub issue client operations that `github-link.md` and `testing.md` defer to #488. Without them, an implementation issue would have to make its own decisions.

## Expected Behavior

- `sync.md` has no unresolved open questions, or lists any that remain with the reason and the issue that will settle them.
- The "Required tests" section matches the rules in the file.
- Related spec files are consistent with it.
- No code, migrations or endpoints are added.

## Solution

The decisions below were settled in the enhancement dialogue; the specs PR writes them into `sync.md` and applies the housekeeping list to the related files.

### Fields and ownership

- **Synced fields:** `title`, `body` and `state`, all three **two-way**. No side owns a field outright: either side may change any of the three, and conflicts are settled per field by E6 to E11 of `edge-cases.md` (base snapshot plus newest timestamp per field).
- **`state_reason` is not synced (accepted loss, v1).** A push never sends `state_reason`. Because a push carries only changed fields, an edit of the title or body leaves a GitHub "not planned" close untouched; a close pushed from Kerghan gets GitHub's default reason (`completed`), and a reopen gets GitHub's default too. This settles `model.md` row 15 (E55) as a documented known limitation; storing `state_reason` is a follow-up with no owner issue yet.
- **Push payload is a diff.** The `PATCH` carries only the fields whose current local value differs from the base snapshot (after the conflict rules drop fields GitHub wins); a push with an empty diff makes no call and clears the marker (E8).
- **Values are verbatim.** Inbound values are stored exactly as GitHub returns them, except a blank body, which is stored as `NULL` (the existing `model.md` rule). Comparisons (local vs base, base vs remote) treat `NULL` and `''` as equal and apply no other normalization (no CRLF or whitespace rewriting), so what Kerghan stores matches GitHub byte for byte.
- Title and body limits already match GitHub's (256 and 65536 characters), so an inbound value never needs truncation.

### Conflict mechanics (one reconcile algorithm)

Every sync job runs the same **reconcile** of one link; an inbound refresh is a reconcile with no marker, and a refresh of a link that has a marker also pushes (the marker already means a push is wanted). One code path, one set of E6 to E11 tests.

1. **Read the marker** (revision `R`, its `updated_at` `Tm`, or none), the issue's local values (L) and the base snapshot (B).
2. **Read GitHub first, always**, with a conditional `GET` (`If-None-Match` with the stored `etag`). A `304` means GitHub equals the base for all three fields (G = B). A blind `PATCH` is rejected: E6 and E7 need GitHub's current values.
3. **Merge per field** (title, body, state):

   | L vs B | G vs B | Outcome |
   |---|---|---|
   | equal | equal | Nothing. |
   | equal | differs | Pull: local and base take G. |
   | differs | equal | Push L. |
   | differs | differs, L = G | E8: base takes L, no push for the field. |
   | differs | differs, L ≠ G | E7: if `Tm` ≥ G's `updated_at` (tie to Kerghan), push L; otherwise pull G (local and base take G) and drop the field from the push. |

4. **Push** a `PATCH` with only the fields left to push (empty diff: no call).
5. **Commit** in one transaction, in lock order (projects, issues, links, markers):
   - the base takes the pushed values;
   - `github_updated_at` takes the `PATCH` response's `updated_at` (or the `GET`'s when nothing was pushed), and `last_synced_at` is set;
   - the pulled fields are written to the issue and to the base **only if the marker revision is still `R`** (or still absent);
   - the marker is deleted `WHERE link_id = ? AND revision = R` (compare-and-clear).
6. **Revision changed during the job** (E10, E41): only the push effects are committed (base of pushed fields, timestamps). The pulled fields are skipped entirely, **neither local nor base** is touched, and the job re-enqueues itself; the next reconcile re-reads GitHub and sees them again as a pull or a conflict. Updating the base without the local value would make the next run push the stale local value over GitHub's change. The marker revision is per link, so any edit skips all pulled fields; this adds no loss beyond E7's accepted per-issue timestamp limitation.

- **Ping-pong (E11).** A pull never creates a marker, and the base takes the pushed values together with the `PATCH`'s `updated_at`, so GitHub's own bump after our push is not seen as a remote change.
- **ETag from `GET` only.** The `etag` is stored from each `200` `GET` and set to `NULL` after a `PATCH`, so the read after a push is a full `GET`; no assumption is made that a `PATCH` response's ETag matches a later `GET`.

### Triggers

Every trigger enqueues the same reconcile job with a link id. No trigger fires for a `gone` link (E1). Triggers stay on demand: no timer or polling.

| # | Event | Enqueues |
|---|---|---|
| T1 | A local edit that changes a synced field of a linked issue | The marker upsert (same transaction as the edit), then one reconcile, enqueued **after the commit** so the job never reads uncommitted rows. A crash between commit and enqueue is covered by T5. Enqueued on every such edit, with no dedupe: duplicates are harmless by E13 (a later job finds no marker and costs at most a `304` `GET`). |
| T2 | The user's manual refresh of one issue | One reconcile, with or without a marker. |
| T3 | The user's manual refresh of a project | One reconcile per non-`gone` link of the project's issues, oldest `last_synced_at` first (never-synced first). The burst is governed by the rate-limit rules. |
| T4 | The user's manual "retry sync" on a link | One reconcile (state transitions are in the `sync_failed` section). |
| T5 | Boot | One reconcile per marker, oldest `marked_at` first (already decided in `model.md`). |
| T6 | A reconcile whose compare-and-clear deletes no row (the revision changed) | The same reconcile again. |

- **No approval trigger (E24).** `denied` is final in `user-approval.md` (approve only moves `pending` to `approved`; there is no un-deny), and `authorization-request.approved` is login authorization, not account approval. So no listener re-enqueues a user's markers: they stay until the user is deleted, and boot or retry jobs stop at the approval guard with no call. A future un-deny feature must re-enqueue the user's markers itself.
- **No trigger** for link creation or attach (the request already reads GitHub, E61), unlinking, `gone`, a repository change, or fixing or adding an integration (E19: fixing the integration does not push by itself; the user retries).
- Routes and payloads for T2 to T4 are #489's; wording and placement are #491's.

### Job design

- **One job, `issues.reconcile`**, registered by the Issues module on init through `WorkersService.register`, with the issues sync service injected as an attribute. Params are **`{ linkId }` only** (no user id, content or credential). Push and refresh are the same job (one reconcile algorithm).
- **Thin job.** `perform()` calls the sync service's `reconcile(linkId, { lastAttempt })` and maps its outcome:

  | Outcome | Job |
  |---|---|
  | `done` | Finishes cleanly. |
  | `requeue` (compare-and-clear missed, T6) | Enqueues a fresh `issues.reconcile` (fresh attempts), then finishes. |
  | `stopped` (no-op, `gone`, credential reasons, `forbidden`, user not approved, repository Unavailable) | Finishes cleanly; the service has already written any state. No retry. |
  | `transient` (`5xx`, timeout, network error, unclassifiable `301`) | `_fail`, so the engine retries after its cooldown. On the last attempt the service instead sets `sync_failed` with reason `retries_exhausted` and the job finishes cleanly. |
  | `rate_limited(until)` | Finishes cleanly, never `_fail` (E17): the link waits for the integration's reset (rate-limit section). |

- **Exhaustion is detected by the job's own counter.** `deku-swarm` dead-letters an exhausted job with no hook, so the job instance keeps a private attempt counter, incremented at the start of each `perform()` (the same instance is reused across retries), and passes `lastAttempt = attempts >= maxRetries` to the service. No reliance on library internals; the `(engine)` spec verifies it against the real `deku-swarm`.
- **Guard order** inside `reconcile`, before any GitHub call:
  1. The link exists, is not `gone`, and its project is live. Otherwise a silent no-op (E32, E40, E1).
  2. The project owner is `approved`. Otherwise stopped, no call, marker kept (E24).
  3. The project's repository is not Unavailable (Unknown is allowed). Otherwise stopped, no call, marker kept, no retry; the derived "repository unavailable" state shows and the next trigger tries again (E26).
  4. At least one candidate integration resolves (integration-selection section). Otherwise `sync_failed` with `no_credential` (E20) or `credential_invalid`, no call.
  5. At least one candidate is not paused by a rate limit (rate-limit section). Otherwise the link joins a waiting set, no call.
- **Idempotence** comes from guarded writes, compare-and-clear and a fixed-value `PATCH` (E13, E15); the job holds no state beyond its attempt counter, and correctness never depends on dedupe.
- **Logs** carry safe fields only: `jobId`, `linkId`, the outcome kind and, on failure, the error class. Never a title, body, URL with a token, header or credential.

### Rate limits

- **Source of the delay.** The Integrations client already answers `rate_limited` with `resetAt` (from `retry-after`, else `x-ratelimit-reset`; HTTP responses expose it as `retryAfterSeconds`). When it is `null` (typically a secondary limit), the pause is **60 seconds**, GitHub's recommended minimum.
- **Pause per integration.** An in-memory pause keyed by **integration id** (an id, never a credential) holds the reset time. GitHub limits per token or installation, so another integration of the same owner keeps working.
- **Waiting set and one timer per integration.** A reconcile that gets `rate_limited`, or that finds its resolved integration paused (guard 5), adds its `linkId` to that integration's waiting set (deduplicated) and finishes cleanly, with no GitHub call while waiting. One timer per integration, driven by the injected `Clock` and scheduler, enqueues one `issues.reconcile` per waiting link at the reset, oldest marker first (links without a marker last), then clears the set. A later `rate_limited` answer re-arms the pause and the timer.
- **Waits never count toward the retry limit (E17).** A rate-limited job finishes instead of `_fail`, so its attempt counter is never consumed; the resumed job is fresh. A rate limit alone never sets `sync_failed` and never loses a write (the marker stays).
- **Derived state.** A link shows "rate limited until X" while it is in a waiting set; X is the integration's reset time. It is in memory only and never stored.
- **Restart.** Pauses and waiting sets are lost. Boot re-enqueues every marker (T5); the first call that hits the limit pauses again. A waiting refresh with no marker is lost and re-triggered by the user (E16).
- **No write pacing in v1.** Pool size (3) bounds concurrency; secondary limits are handled as `rate_limited` with the 60-second fallback. Serial, spaced writes per integration are a possible follow-up if secondary limits show up in practice.

### Retry values and `sync_failed` transitions

- **Retry values.** `issues.reconcile` overrides the `deku-swarm` getters on its class: **`maxRetries` 5, `cooldown` 30 seconds** (a fixed cooldown; `deku-swarm` has no exponential backoff), giving about two minutes to ride out a short GitHub outage. They are read from issues-specific config keys `KERGHAN_ISSUES_SYNC_MAX_RETRIES` and `KERGHAN_ISSUES_SYNC_COOLDOWN_MS` (positive integers, falling back to 5 and 30000), independent of the engine-wide `KERGHAN_WORKERS_*` values. Only transient failures (`5xx`, timeout, network error, unclassifiable `301`) consume attempts.
- **Set** (by any trigger, including a refresh with no marker; the latest reason overwrites an earlier one):

  | Reason | When |
  |---|---|
  | `retries_exhausted` | The last transient attempt fails. |
  | `no_credential` | No integration resolves at all, or only a GitHub handle (E20). No call is made. |
  | `credential_invalid` | A `401` on any call (the Integrations module marks the integration `invalid`, E19), or the only candidates are integrations already `invalid`. |
  | `forbidden` | A non-rate-limit `403` on any call (E5, E21; reached in one attempt, no retry), or a `404` whose issues probe fails with `403` or `404` (access lost, E22). A probe failing with `401` is `credential_invalid`. |

- **Left** (back to `linked`, reason `NULL`) by:
  - a push whose compare-and-clear deletes the marker;
  - a successful reconcile when no marker exists (so a refresh never clears a failure that belongs to an unsent write);
  - the **retry sync** action, which resets the status to `linked` at once and enqueues T4; the UI then shows the derived *pending* state, and the job sets the failure again if it still fails;
  - `gone`, which replaces it.
- An edit never writes a status (existing rule); it only creates the marker and enqueues T1. `sync_failed` never blocks a job: every trigger still runs, and credential reasons stop at the guards with no call where they can.
- The reason set stays at the four values already in `model.md`; no `access_lost` reason is added.

### Staleness and refresh

- **`last_synced_at`** is set by every successful reconcile and by link creation or attach (which read GitHub in the request, E61), so a link is never "never synced".
- **Stale** means `last_synced_at` is older than `KERGHAN_ISSUES_SYNC_STALE_AFTER_SECONDS` (positive integer, default 3600). The backend derives a `stale` flag next to `lastSyncedAt` (one rule; #489 exposes both, #491 words them). It is never stored and never a link state. A `gone` link is never reported stale.
- **Display only.** A stale link is shown as such ("last synced X ago" plus a stale hint) and the user refreshes it (T2 or T3). A read never enqueues a job, so every GET stays side-effect free and triggers remain on demand only; no auto-refresh on open or on the issue list.
- **Manual refresh skips fresh links.** T2 and T3 skip any link **without a marker** whose `last_synced_at` is under 60 seconds old; a single-issue refresh of such a link answers "already fresh" (shape owned by #489). A link with a marker is never skipped, since it has a write to push. No cooldown state or `429` is needed, and repeated presses cost nothing.

### Integration selection

- **Candidates.** The project owner's **usable** integrations (`listUsableIntegrations`: `active` and type enabled) whose source lists the project's repository in `repositories_sources`, read through Repositories' exported service (never a join). A handle-only listing is not a candidate (E20). Resolved at job time; nothing in the feature stores an integration id (`model.md` cleanup rule), and the owner's integrations are used whoever triggered the job.
- **None.** No candidate: `sync_failed` with `no_credential`, or `credential_invalid` when an integration lists the repository but is not usable (`expired`, `invalid`, `undecryptable`). No call is made.
- **Order.** Write-capable types first (PAT and OAuth app before GitHub App, which is read-only until #490 decides), oldest first within a type.
- **Fallback on credential failures only**, mirroring Repositories' sync: on a `401`, a non-rate-limit `403` or `integration_unusable`, the reconcile restarts from its `GET` with the next candidate, within the same attempt (a `401` still marks that integration `invalid`, existing rule). A rate limit, timeout or `5xx` never falls back. When every candidate fails on credentials, the reason is `forbidden` if any answered a `403`, else `credential_invalid`.
- **Paused candidates are skipped** (rate-limit section). When every candidate is paused, the link joins the waiting set of the one whose reset comes first.
- **The E22 probe** runs with the same candidate that got the `404`.
- Logs and job params never name which credential served a call beyond the integration id.

### Marker lifecycle details

Complements the marker rules of `model.md` (coalesced, no payload, compare-and-clear, boot oldest first, attempts in memory).

- **Creation.** An edit that changes a synced value creates or bumps the marker while the link is `linked` or `sync_failed`, including while the repository is Unavailable, the integration is rate limited or the user has no credential. Only `gone` blocks a marker (E1). `marked_at` is set only on insert; `updated_at` and `revision` move on every value-changing edit; both timestamps come from the injected `Clock`.
- **Commit guard.** The reconcile's commit locks the link and applies only if the link still exists and is not `gone`; otherwise it writes nothing (E1 race, E32).
- **Compare-and-clear miss.** Re-read the marker under the lock: if it still exists (its revision moved), enqueue again (T6); if it was deleted (unlink with confirmation, project or user deletion), finish with no new job.
- **Boot enqueues every marker**, oldest `marked_at` first, with no filtering: the guards stop markers of non-approved users, Unavailable repositories or missing credentials with no GitHub call, and one attempt per boot is an accepted recovery path (E18).
- **Markers never expire.** A marker lives until it is pushed, discarded by an unlink with confirmation (E63), removed by project or user deletion, or removed when the link becomes `gone`. An unsent write is never dropped silently; the link shows *pending* or `sync_failed` until then.
- **Several backend instances.** Correctness never assumes a single instance: each instance's boot re-enqueue produces duplicate jobs, which are harmless (E13). Rate-limit pauses and waiting sets are per instance (in memory).

### GitHub issue client operations

Added to `IntegrationsGithubService`, following its existing shape (`(userId, integrationId, …)`, `kind` unions sharing `RepoFailure` = `invalid_credentials | rate_limited{resetAt} | unavailable{reason} | integration_unusable{reason}`). `repo` is `{ owner, name }` from the repository row; `issue` is `{ id, number, title, body, state, updatedAt, isPullRequest }`.

| Operation | Success kinds | Issue-specific kinds (plus `RepoFailure`) |
|---|---|---|
| `getIssue(userId, integrationId, repo, number, etag?)` | `ok{issue, etag}`, `not_modified` | `not_found`, `gone` (`410`), `moved`, `forbidden` |
| `updateIssue(userId, integrationId, repo, number, changes)` | `ok{issue}` | `not_found`, `gone`, `moved`, `forbidden` |
| `probeIssues(userId, integrationId, repo)` | `ok` | `not_found`, `forbidden` |

- `changes` holds only the fields to push (`title?`, `body?`, `state?`); never `state_reason`.
- `renamed` stays adapter-internal: the client retries once at the `Location` and returns the result with a `renamedTo` hint, which the caller hands to Repositories (E65).
- **`forbidden` is its own kind** (a non-rate-limit `403`) for issue operations, rather than `unavailable{reason:'forbidden'}`, so the sync tells E5 and E21 apart from transient failures without inspecting reasons.
- Listing for import is not #488's (link creation, #487/#489).

### Spec housekeeping (to apply in the specs PR)

- **`sync.md`:** rewrite from the decisions above; close all five open questions; drop "depends on #479" (#479 is closed and `WorkersService` exists, `docs/agents/modules/workers.md`); rewrite "Required tests".
- **`model.md`:** keep the base snapshot (not dropped for last-write-wins); settle row 15 (E55) as an accepted loss; define `etag` (from `GET` only, `NULL` after a `PATCH`), `github_updated_at` and `last_synced_at` (also set on link creation); the four `sync_failed` reasons are final; no "links by status" index is needed; add the marker lifecycle details; close its #488 open question.
- **`github-link.md`:** fill the "#488" cells of the link-states table with the transitions above; write the normalization invariant (verbatim, blank body to `NULL`, `NULL` equals `''`); add the client operations; close its #488 open question.
- **`edge-cases.md`:** E5 to E11, E13, E15 to E21 and E24 move from `Contract` to **`Decided`**, with Rule links to the `sync.md` sections; E24 is reworded: jobs make no GitHub call for a user who is not `approved` and the markers stay until the user is deleted; `denied` is final (`docs/agents/modules/auth/user-approval.md`, no un-deny), so nothing resumes them, and a future un-deny feature must re-enqueue the user's markers; close the retry-values and integration-selection open question.
- **`testing.md`:** the GitHub fake mirrors `getIssue`, `updateIssue` and `probeIssues`; `FakeClock` and an injected scheduler drive the rate-limit timer, the stale threshold and the 60-second fresh skip; the `(engine)` spec checks the job's own attempt counter against the real `deku-swarm` with the issues retry config; close its operation-names question and the matching note in `issues.md`.
- **`api.md` (inputs for #489):** `lastSyncedAt` and `stale`; the "already fresh" answer; the project refresh (T3); retry sync resets the status to `linked` and enqueues.
- **`ui.md` (inputs for #491):** the stale hint and "last synced X ago".
- **`security.md`:** rate-limit pauses are keyed by integration id only; the allowlist of log fields (`jobId`, `linkId`, outcome kind, error class).
- **`docs/agents/environment-variables.md`:** `KERGHAN_ISSUES_SYNC_MAX_RETRIES`, `KERGHAN_ISSUES_SYNC_COOLDOWN_MS`, `KERGHAN_ISSUES_SYNC_STALE_AFTER_SECONDS`.
- **`docs/agents/modules/workers.md`:** the `issues.reconcile` job and its per-class retry override.
- **This issue's Notes:** "waits for #479" is outdated; #479 is done.

## Benefits

- An implementation issue can build the sync workers against `sync.md` with no open decisions.
- One reconcile algorithm and one thin job keep the code path and the tests small.
- Rate limits, credential failures and restarts never lose a write, and every failure state has a defined way out.
