# Issues and Projects — Edge cases

Purpose: a matrix of edge cases across projects, issues, the GitHub link and the sync, each row giving the expected behavior, the owning file and the verifying check.
Part of the [Issues and Projects specs](../issues.md).

## How to read this matrix

- The matrix is an **index, not a second source of truth** (same shape as the [Repositories matrix](../../modules/repositories/edge-cases.md)): one line of outcome per row, linking to the rule in its owning file. A change of outcome is made in the owning file first, then reflected here.
- Columns: `#` | Case | Expected behavior (data, GitHub calls, what the user sees) | Rule (owning file) | Check (the required test) | Status.
- Status: `Decided` (the rule is already written in `projects.md` or `model.md`) or `Contract` (the outcome is fixed here; the owner issue refines the mechanics and updates the row in its own PR if the outcome changes).
- Row ids are stable (`E1…E64`), so tests, [testing.md](testing.md) and other files can cite them. Ids are not renumbered when a group is reordered.
- Groups, in order: projects; GitHub issue and link; link creation, unlinking and repository change; edits and conflicts; jobs, restart and rate limits; credentials and integrations; repository; users and cleanup.
- Each row is one required test; rows already tested in `projects.md` or `model.md` point there instead of repeating.

## Projects

The seven project rows are owned by [projects.md](projects.md#edge-cases).

| # | Case | Expected behavior | Rule | Check | Status |
|---|---|---|---|---|---|
| E34 | Two simultaneous creations on one repository | The database uniqueness decides: `409` on the explicit path; the shortcut re-reads and returns the winner (`200`). | [projects.md](projects.md#edge-cases) | Concurrency test on both paths, in `projects.md`. | Decided |
| E35 | Two simultaneous creations or renames to one name | One wins, the other answers `409`. | [projects.md](projects.md#edge-cases) | Concurrency test, in `projects.md`. | Decided |
| E36 | Create or attach on a repository that has only a deleted project | Allowed. | [projects.md](projects.md#edge-cases) | Create and attach after deletion, in `projects.md`. | Decided |
| E37 | Repository renamed or transferred on GitHub | The project is untouched; the summary shows the current `owner/name`. | [projects.md](projects.md#edge-cases) | Summary read after a rename, in `projects.md`. | Decided |
| E38 | Repository goes Unavailable and returns | The project is untouched; sync is refused only while Unavailable. | [projects.md](projects.md#edge-cases) | Sync gating by status, in `projects.md`. | Decided |
| E39 | Repository added but Unavailable at creation | Allowed. | [projects.md](projects.md#edge-cases) | Create with an Unavailable repository, in `projects.md`. | Decided |
| E40 | Job or request for a deleted project or user | A job is a no-op; a request answers `404`. | [projects.md](projects.md#edge-cases) | Job and request after deletion, in `projects.md`. | Decided |

## GitHub issue and link

| # | Case | Expected behavior | Rule | Check | Status |
|---|---|---|---|---|---|
| E1 | GitHub issue deleted (`404` or `410` on a read or a push, repository Added) | The Kerghan issue is never deleted or closed. The link enters the `gone` state (reason `deleted`), its marker is discarded, and edits stop creating markers (nothing to push to). Local edits continue with no further GitHub call for that link; the user unlinks to clean up. No retry loop and no endless boot re-enqueue. | [github-link.md](github-link.md#gone-transferred-and-repository-unreachable) | Gone state after a `404` or `410`; marker discarded; a later edit creates no marker; no job re-enqueued at boot. | Contract |
| E2 | GitHub issue transferred to another repository | A `301` makes the link `gone` with reason `moved`. Kerghan never follows a transfer: a link stays inside the project's repository. | [github-link.md](github-link.md#gone-transferred-and-repository-unreachable) | A `301` answers `gone` with reason `moved`; no link to the new repository. | Contract |
| E3 | The GitHub issue is a pull request | Attaching it is refused and an import skips it (a refresh skips it too). | [github-link.md](github-link.md#creating-a-link) | Attach refused; import skips pull requests. | Contract |
| E4 | A GitHub issue already linked by this user | Refused by the unique (`user_id`, `github_issue_id`) index. | [model.md](model.md#edge-cases) row 6 | The `model.md` row 6 test. | Decided |
| E5 | Repository archived or read-only on GitHub (`403` on a push) | A permission refusal, not a transient error: same outcome as a revoked credential (E19). Reads still work. | [sync.md](sync.md) (#488) | A `403` on a push follows E19. | Contract |

## Link creation, unlinking and repository change

Owned by [github-link.md](github-link.md); ids continue after E56.

| # | Case | Expected behavior | Rule | Check | Status |
|---|---|---|---|---|---|
| E57 | Link creation: the issue is not found, `410` or `301` | Refused as not found; nothing stored, no job. | [github-link.md](github-link.md#creating-a-link) | Each answer refuses; the link table and the job log are unchanged. | Contract |
| E58 | Link creation while rate limited | Refused with `retryAfterSeconds`; nothing stored, no job, no wait. | [github-link.md](github-link.md#creating-a-link) | A rate-limited read refuses with the delay and stores nothing. | Contract |
| E59 | Link creation with no usable integration, a `401` or a `403` | Refused with the credential reason; a `401` invalidates the integration, a `403` does not; a handle alone is not enough (E20). | [github-link.md](github-link.md#creating-a-link) | Each case refuses with its reason; only a `401` invalidates. | Contract |
| E60 | Link creation with a timeout, network error or `5xx` | Refused as GitHub unavailable; nothing stored. | [github-link.md](github-link.md#creating-a-link) | Each failure refuses and stores nothing. | Contract |
| E61 | Attach where local values differ from GitHub's | Refused without the confirmation; with it the local values are replaced, no marker, no GitHub write. | [github-link.md](github-link.md#creating-a-link) | Without the flag nothing changes; with it the values equal GitHub's and no call writes. | Contract |
| E62 | Repository change or detach with links, and the race with a link creation | Refused with `409` carrying the link count; a concurrent link is never left against a changed repository. | [github-link.md](github-link.md#same-repository-rule-and-repository-changes) | Refused with links, allowed at zero; the race leaves no link on a changed repository. | Contract |
| E63 | Unlink with unsent changes | Refused without the confirmation; with it the marker is discarded and the response says so. | [github-link.md](github-link.md#unlinking) | Without the flag link and marker stay; with it both are deleted and the issue is kept. | Contract |
| E64 | Attach to an already linked Kerghan issue, or unlink an issue with no link | Both refused, never silent. | [github-link.md](github-link.md#unlinking) | Both answer a refusal and change nothing. | Contract |

## Edits and conflicts

| # | Case | Expected behavior | Rule | Check | Status |
|---|---|---|---|---|---|
| E6 | Both sides change **different** fields | Both changes are kept: the refresh updates the field GitHub changed, and the marker pushes only the field Kerghan changed (per field, using the base snapshot). | [sync.md](sync.md) (#488) | Title changed on one side, body on the other; both survive. | Contract |
| E7 | Both sides change the **same** field to different values | **Newest timestamp wins, per field**: the time of the last Kerghan edit (the marker's `updated_at`) against GitHub's `updated_at` as last read. A tie goes to Kerghan (deterministic). If GitHub wins, the base takes GitHub's value and the field is dropped from the push; if Kerghan wins, it is pushed. | [sync.md](sync.md) (#488) | Kerghan newer, GitHub newer and tie, each checked. | Contract |
| E8 | Both sides change the same field to the **same** value | Not a conflict: the base is updated and the marker cleared with no GitHub call. | [sync.md](sync.md) (#488) | Equal values clear the marker and make no call. | Contract |
| E9 | Inbound refresh while a marker exists | Applied per field with the base snapshot; a field with an unsent local change is never blindly overwritten (E6 and E7 decide). | [sync.md](sync.md) (#488) | A refresh keeps a field with an unsent edit unless E7 says GitHub wins. | Contract |
| E10 | A local edit lands while an inbound refresh is applied | The refresh applies in one guarded transaction and skips any field whose marker revision changed since it was read, then re-reads. | [sync.md](sync.md) (#488) | Concurrent edit and refresh; the edit is not lost. | Contract |
| E11 | Ping-pong | An inbound apply never creates a marker; a push writes the pushed values to the base, so GitHub's own `updated_at` bump after our push is not a remote change. | [sync.md](sync.md) (#488) | A push followed by a refresh creates no marker and no further push. | Contract |
| E12 | An edit that changes no value | No marker and no revision bump. | [model.md](model.md#issues_pending_writes-the-pending-marker) (#486) | A no-op edit leaves the marker table and the revision unchanged. | Contract |

**Known limitation of E7 (accepted).** The timestamps are per issue, not per field. GitHub's `updated_at` also moves on a comment, label or assignee change, so a later comment on GitHub can make GitHub look newer for a field it did not touch, but only when both sides changed that very field. The marker's `updated_at` moves on any synced-field edit. Per-field timestamps would need a column per field (not in v1). GitHub keeps the edit history of titles and bodies; Kerghan keeps none.

## Jobs, restart and rate limits

| # | Case | Expected behavior | Rule | Check | Status |
|---|---|---|---|---|---|
| E13 | Duplicate jobs for one link | Harmless by design: each job diffs against the base and uses compare-and-clear; the worst case is one redundant `PATCH` with the same values. An in-memory per-link dedupe is optional; correctness never depends on it. | [sync.md](sync.md) (#488) | Two jobs for one link leave one correct state. | Contract |
| E14 | Restart with pending writes | Every marker is re-enqueued once, oldest first. | [model.md](model.md#edge-cases) row 11 | The `model.md` row 11 test. | Decided |
| E15 | Crash after GitHub accepted a push, before the marker was cleared | The marker survives; the next job re-pushes the same values (an idempotent `PATCH`), or a refresh finds GitHub equal to local (E8). | [sync.md](sync.md) (#488) | Simulated crash before the clear; the next job converges. | Contract |
| E16 | Shutdown mid-job | The in-memory queue is lost; markers are the source of truth; an unmarked on-demand refresh is lost and re-triggered by the user. | [sync.md](sync.md) (#488) | Restart after a mid-job stop re-enqueues the marker. | Contract |
| E17 | Rate limit with `retryAfterSeconds` | The marker stays; calls for that credential pause until the reset with no call made while waiting. **Waits do not count toward the retry limit**: a rate limit alone never sets `sync_failed` or loses a write; the link shows "rate limited until X". | [sync.md](sync.md) (#488) | Rate-limited jobs make no call until the reset and never reach `sync_failed`. | Contract |
| E18 | Retries exhausted | The link becomes `sync_failed` and the marker is kept. Recovery: a manual "retry sync" action, a later edit, or a restart (attempts are in memory). | [sync.md](sync.md) (#488) | Exhausted retries set `sync_failed`; each recovery path re-enqueues. | Contract |

## Credentials and integrations

| # | Case | Expected behavior | Rule | Check | Status |
|---|---|---|---|---|---|
| E19 | Credential revoked or invalid with a pending write (`401`, the integration becomes `invalid`) | Not transient: no retry loop. The job stops, the marker is kept, and the link shows sync failed with a credential reason ("Fix it in Integrations"). Fixing the integration does not push by itself (on-demand triggers only). | [security.md](security.md) (#488, #490) | A `401` stops the job, keeps the marker and shows the credential reason. | Contract |
| E20 | No integration at all, or only a GitHub handle | Local edits work and the marker is created; the job refuses before any GitHub call, with the same outcome as E19 (reason: no credential). | [sync.md](sync.md) (#488) | No call is made; the marker stays; the reason is "no credential". | Contract |
| E21 | Read-only credential or no write permission (`403` on a push) | Same as E19. Only a `401` invalidates an integration (existing rule). | [security.md](security.md) (#488, #490) | A `403` does not invalidate the integration and follows E19. | Contract |
| E22 | `404` on a linked GitHub issue | "Gone" (E1) only if a read of the repository with the same credential succeeds; otherwise it is access loss, handled as E19. This avoids discarding a marker because a credential lost access. | [github-link.md](github-link.md#gone-transferred-and-repository-unreachable) | `404` with a readable repository is gone; with an unreadable one it follows E19. | Contract |
| E23 | Integration deleted with pending writes | No hook; once no usable integration remains, this is E20. | [model.md](model.md) (#486) | Delete the last integration; the next job follows E20. | Decided |
| E24 | Account denied (admin ban) | Jobs make no GitHub call for a user who is not `approved`; markers stay and resume when the user is approved again. | [sync.md](sync.md) (#488) | A denied user's job makes no call; approval resumes it. | Contract |

## Repository

| # | Case | Expected behavior | Rule | Check | Status |
|---|---|---|---|---|---|
| E25 | Repository removed by the future "remove repository" feature | Refused with `409` while a live project of the user uses it. | [projects.md](projects.md#linked-repository-unavailable-or-removed) | Tested by the removal feature when it exists. | Decided |
| E26 | Repository Unavailable, then back | Sync is refused only while Unavailable and allowed while Unknown; markers are kept; local work continues. | [projects.md](projects.md#linked-repository-unavailable-or-removed) | Sync gating by status. | Decided |
| E27 | Repository deleted on GitHub or lost to the credential | It becomes Unavailable through Repositories' sync (E26); nothing is discarded; linked issues are not marked "gone" (E22 needs a successful repository read). | [projects.md](projects.md#linked-repository-unavailable-or-removed) | An Unavailable repository leaves links and markers untouched. | Contract |
| E28 | Repository turns private or public | No change in Kerghan; issue content stays private to the owner; sync follows credential access. | [projects.md](projects.md) | Issue reads stay owner-only after the change. | Contract |
| E29 | Repository renamed or transferred | Nothing happens to the project; the link survives (keyed by `github_issue_id`). | [projects.md](projects.md#edge-cases) | Link and project read after a rename. | Decided |

## Users and cleanup

| # | Case | Expected behavior | Rule | Check | Status |
|---|---|---|---|---|---|
| E30 | Integration deleted | The project is unaffected; pending writes become E20. | [model.md](model.md) | Project read after deleting an integration. | Decided |
| E31 | User deleted, including a listener failure | Everything is removed; a failure is logged and never blocks. | [model.md](model.md#edge-cases) row 13 | The `model.md` row 13 test. | Decided |
| E32 | Project or user deleted, or issue unlinked, while a job runs | The job is a no-op (guarded writes affect no row). | [model.md](model.md#edge-cases) row 4 | The `model.md` row 4 test. | Decided |
| E33 | Project deleted with unsent changes | Markers are discarded; the response reports the count. | [projects.md](projects.md#deletion) | Delete with markers reports the count. | Decided |

## Indexed rows of other files

The data rows of [model.md](model.md#edge-cases) keep their own tests; they are indexed here with ids continuing after E40.

| # | Case | Rule | Status |
|---|---|---|---|
| E41 | An edit lands while a push is in flight | [model.md](model.md#edge-cases) row 1 | Decided |
| E42 | Two simultaneous edits of one linked issue | row 2 | Decided |
| E43 | An edit reverts to the base values | row 3 | Decided |
| E44 | Unlink, project delete or user delete during a push | row 4 | Decided |
| E45 | Two users link the same GitHub issue | row 5 | Decided |
| E46 | One user links one GitHub issue twice at once, or attaches two to one issue | row 6 | Decided |
| E47 | A project is deleted and its GitHub issue is linked again from another project | row 7 | Decided |
| E48 | Two projects race for one repository, including an attach | row 8 | Decided |
| E49 | Soft-deleting an already-deleted project | row 9 | Decided |
| E50 | `deleted_token` reuse | row 10 | Decided |
| E51 | Boot with markers | row 11 | Decided |
| E52 | A crash between the issue update and the marker upsert | row 12 | Decided |
| E53 | A user is deleted and the listener fails | row 13 | Decided |
| E54 | A 4-byte character in a title or body | row 14 | Decided |
| E55 | A GitHub issue with a `state_reason` | row 15 | Decided |
| E56 | A GitHub id above 2³¹ | row 16 | Decided |

## Open questions

- [ ] Retry limits and cooldown values; which integration is used when several can see the repository. (#488)
- [ ] The "retry sync" route and how failed and rate-limited states are exposed. (#489, #491)
- [ ] Per-field timestamps for conflicts: not v1, no owner issue yet.

## Required tests

One test per row, citing its id. Rows touching rows in the database (uniqueness, concurrency, transactions) run in the DB-backed tier; sync rows run against the fake GitHub client of [testing.md](testing.md#fixtures).

**Tier of each row** (default tiers and tags in [testing.md](testing.md#tiers)):

- DB-backed: E4, E12, E62 `(db)` (the race), E14, E16, E31, E34 `(db)`, E35 `(db)`, E42 `(db)`, E43, E45, E46 `(db)`, E47, E48 `(db)`, E49 `(db)`, E50 to E56. E14 and E16 are the restart spec of [testing.md](testing.md#worker-tests).
- Scripted interleaving `(race)`: E10, E15, E32, E41, E44; E13 as a duplicate-jobs spec.
- Unit: E1 to E3, E5 to E9, E57 to E61, E11, E17 to E24, E27, E28; E17 and E18 exhaustion marking also run once on the real engine `(engine)`.
- E2E with fakes: E25 (when built), E26, E29, E30, E33, E36 to E40 (status mapping, access and gating); E18 recovery paths (retry sync route) once #489 fixes it; E62 to E64 answers (E62's race is the `(db)` item above).

- E1 to E3, E5 to E13, E15 to E22, E24, E27, E28 and E57 to E64: new tests defined by the Check column above.
- E4, E14, E23, E25, E26, E29 to E33: tested where the owning file lists them ([model.md](model.md#required-tests), [projects.md](projects.md#required-tests)); E25 waits for the removal feature.
- E34 to E40 are tested in [projects.md](projects.md#required-tests); E41 to E56 in [model.md](model.md#required-tests).
- A rate limit alone never produces `sync_failed` (E17), and a `404` never discards a marker without a successful repository read (E22).
- Jobs make no GitHub call for a user who is not `approved` (E24).
