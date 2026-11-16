# Issue: Enhance the Issues specs: edge cases

## Description

Part of the epic #483 (Issues and Projects): Kerghan gets **projects** (optionally connected to one repository) and **issues** that belong to a project and may be linked one to one to a GitHub issue, kept in sync both ways by background workers. The feature is defined as specs under `docs/agents/specs/issues.md` and `docs/agents/specs/issues/*.md` (lifecycle in `docs/agents/specs.md`). This issue writes `docs/agents/specs/issues/edge-cases.md`, the matrix of edge cases across projects, issues, the GitHub link and the sync. It is documentation only: no code, migrations or endpoints.

## Problem

`edge-cases.md` only points to the project and data rows owned by `projects.md` and `model.md`, and lists seven open questions: a GitHub issue deleted or transferred, a repository removed, an integration or user deleted, concurrent edits on both sides, a revoked credential with a pending write, a restart with pending writes, and rate limits with duplicate jobs. Implementation issues would have to decide each outcome themselves. #493 was started before #487 (link), #488 (sync) and #490 (security) were enhanced, so some outcomes depend on rules those issues own.

## Expected Behavior

`edge-cases.md` is a matrix precise enough to build and test against. Every row states the expected behavior, the spec file that owns the rule and the check that verifies it. The other spec files are consistent with it, and the questions that remain open name the issue that settles them.

## Solution

Write `docs/agents/specs/issues/edge-cases.md` as an index (not a second source of truth) and update the files listed under consistency edits in the same PR.

### Approach

- #487 (link states, deleted or transferred GitHub issue), #488 (conflicts, no-credential rule) and #490 (revoked credential, retention) are not enhanced yet. #493 **fixes the observable outcome** of each case now (data, GitHub calls, what the user sees). The owner issue fills in the mechanics and updates the row in its own PR if it changes the outcome (the rule used for the repository-removal rule).

### Matrix structure

- The matrix is an **index, not a second source of truth** (as in the Repositories matrix, #450): one line of outcome per row, linking to the rule in its owning file. A change of outcome is made in the owning file first, then reflected here.
- Columns: `#` | Case | Expected behavior (data, GitHub calls, what the user sees) | Rule (owning file) | Check (the required test) | Status.
- Status: `Decided` (rule already in `projects.md` or `model.md`) or `Contract` (outcome fixed here; the named owner issue refines the mechanics).
- Stable row ids `E1…En`, so tests, `testing.md` (#494) and other files can cite them.
- Groups, in order: projects; GitHub issue and link; edits and conflicts; jobs, restart and rate limits; credentials and integrations; repository; users and cleanup.
- The 7 project rows (`projects.md`) and the 16 data rows (`model.md`) stay in their files and get one-line index rows here; only new cases get full rows here.
- Required tests: one test per row; rows already tested in `projects.md` or `model.md` point there.

### GitHub issue and link cases

| # | Case | Outcome | Owner | Status |
|---|---|---|---|---|
| E1 | GitHub issue deleted (`404`/`410` on a read or push, repository Added) | The Kerghan issue is never deleted or closed. The link enters a "GitHub issue gone" state (name is #487's), its marker is discarded and edits stop creating markers (nothing to push to). Local edits continue, no further GitHub calls for that link; the user unlinks to clean up. No retry loop and no endless boot re-enqueue. | #487 | Contract |
| E2 | GitHub issue transferred to another repository | Treated like E1, with a distinct reason if #487 can tell them apart. Kerghan never follows a transfer: a link must stay inside the project's repository. | #487 | Contract |
| E3 | The GitHub issue is a pull request | Attaching it is refused; an inbound import skips pull requests. | #487 | Contract |
| E4 | A GitHub issue already linked by this user | Refused by the unique index (`model.md` row 6). | #486 | Decided |
| E5 | Repository archived or read-only on GitHub (`403` on a push) | A permission refusal, not a transient error: same outcome as a revoked credential (see the credentials group). Reads still work. | #488 | Contract |

### Edits and conflicts

| # | Case | Outcome | Owner | Status |
|---|---|---|---|---|
| E6 | Both sides change **different** fields | Both changes are kept: the refresh updates the field GitHub changed, the marker pushes only the field Kerghan changed (per field, using the base snapshot). | #488 | Contract |
| E7 | Both sides change the **same** field to different values | **Newest timestamp wins, per field**: the time of the last Kerghan edit (the marker's `updated_at`) against GitHub's `updated_at` as last read. A tie goes to Kerghan (deterministic). If GitHub wins, the base takes GitHub's value and the field is dropped from the push; if Kerghan wins, it is pushed. | #488 | Contract |
| E8 | Both sides change the same field to the **same** value | Not a conflict: the base is updated and the marker cleared with no GitHub call. | #488 | Contract |
| E9 | Inbound refresh while a marker exists | Applied per field with the base snapshot; a field with an unsent local change is never blindly overwritten (E6, E7 decide). | #488 | Contract |
| E10 | A local edit lands while an inbound refresh is applied | The refresh applies in one guarded transaction and skips any field whose marker revision changed since it was read, then re-reads. | #488 | Contract |
| E11 | Ping-pong | An inbound apply never creates a marker; a push writes the pushed values to the base, so GitHub's own `updated_at` bump after our push is not a remote change. | #488 | Contract |
| E12 | An edit that changes no value | No marker and no revision bump. | #486 | Contract |

Known limitation of E7 (accepted, to be stated in the spec): the timestamps are per issue, not per field. GitHub's `updated_at` also moves on a comment, label or assignee change, so a later comment on GitHub can make GitHub look newer for a field it did not touch, but only when both sides changed that very field; and the marker's `updated_at` moves on any synced-field edit. Per-field timestamps would need a column per field (not in v1). GitHub keeps the edit history of titles and bodies; Kerghan keeps none.

### Jobs, restart, rate limits and credentials

| # | Case | Outcome | Owner | Status |
|---|---|---|---|---|
| E13 | Duplicate jobs for one link | Harmless by design: each job diffs against the base and uses compare-and-clear; the worst case is one redundant `PATCH` with the same values. An in-memory per-link dedupe is optional; correctness never depends on it. | #488 | Contract |
| E14 | Restart with pending writes | Every marker is re-enqueued once, oldest first (`model.md` row 11). | #486 | Decided |
| E15 | Crash after GitHub accepted a push, before the marker was cleared | The marker survives; the next job re-pushes the same values (idempotent `PATCH`), or a refresh finds GitHub equal to local (E8). | #488 | Contract |
| E16 | Shutdown mid-job | The in-memory queue is lost; markers are the source of truth; an unmarked on-demand refresh is lost and re-triggered by the user. | #488 | Contract |
| E17 | Rate limit with `retryAfterSeconds` | The marker stays; calls for that credential pause until the reset with no call made while waiting (as Repositories' sync). **Waits do not count toward the retry limit**: a rate limit alone never sets `sync_failed` or loses a write; the link shows "rate limited until X". | #488 | Contract |
| E18 | Retries exhausted | Link `sync_failed`, marker kept. Recovery: a manual "retry sync" action, a later edit, or a restart (attempts are in memory). | #488 | Contract |
| E19 | Credential revoked or invalid with a pending write (`401`, integration becomes `invalid`) | Not transient: no retry loop. The job stops, the marker is kept, the link shows sync failed with a credential reason ("Fix it in Integrations"). Fixing the integration does not push by itself (on-demand triggers only). | #488, #490 | Contract |
| E20 | No integration at all, or only a GitHub handle | Local edits work and the marker is created; the job refuses before any GitHub call, same outcome as E19 (reason: no credential). | #488 | Contract |
| E21 | Read-only credential or no write permission (`403` on a push) | Same as E19. Only a `401` invalidates an integration (existing rule). | #488, #490 | Contract |
| E22 | `404` on a linked GitHub issue | "Gone" (E1) only if a read of the repository with the same credential succeeds; otherwise access loss, handled as E19. Avoids discarding a marker because a credential lost access. | #487 | Contract |
| E23 | Integration deleted with pending writes | No hook; once no usable integration remains, this is E20. | #486 | Decided |
| E24 | Account denied (admin ban) | Jobs make no GitHub call for a user who is not `approved`; markers stay and resume when the user is approved again. | #488 | Contract |

### Repository and cleanup cases

| # | Case | Outcome | Owner | Status |
|---|---|---|---|---|
| E25 | Repository removed by the future "remove repository" feature | Refused with `409` while a live project of the user uses it. | projects.md | Decided |
| E26 | Repository Unavailable, then back | Sync refused only while Unavailable, allowed while Unknown; markers kept; local work continues. | projects.md | Decided |
| E27 | Repository deleted on GitHub or lost to the credential | It becomes Unavailable through Repositories' sync (E26); nothing is discarded; linked issues are not marked "gone" (E22 needs a successful repository read). | projects.md | Contract |
| E28 | Repository turns private or public | No change in Kerghan; issue content stays private to the owner; sync follows credential access. | projects.md | Contract |
| E29 | Repository renamed or transferred | Nothing happens to the project; the link survives (keyed by `github_issue_id`). | projects.md | Decided |
| E30 | Integration deleted | The project is unaffected; pending writes become E20. | model.md | Decided |
| E31 | User deleted, including a listener failure | Everything removed; a failure is logged and never blocks (`model.md` row 13). | model.md | Decided |
| E32 | Project or user deleted, or issue unlinked, while a job runs | The job is a no-op (guarded writes affect no row). | model.md | Decided |
| E33 | Project deleted with unsent changes | Markers discarded; the response reports the count. | projects.md | Decided |

The 16 data rows of `model.md` and the 7 project rows of `projects.md` are also indexed as one-liners (ids continue after E33).

### Consistency edits to other spec files (same PR)

- `sync.md`: the conflict question moves to "outcome fixed in edge-cases (E6 to E11); mechanics #488"; rate-limit and credential rules point to E17 to E24.
- `github-link.md`: the deleted or transferred question is answered at outcome level (E1 to E3, E22); state names stay with #487.
- `security.md`: the revoked or read-only credential outcome (E19 to E21); how a write-capable credential is requested stays with #490.
- `model.md`: a note that the marker's `updated_at` is the last local edit time used by E7, and that a no-op edit creates no marker (E12).
- `ui.md`: the states that must be displayed (gone, rate limited until X, sync failed with a credential reason) and the "retry sync" action.
- `api.md`: a "retry sync" trigger added to the open questions (#489).
- `issues.md` index and `edge-cases.md` header/index updated.

### Open questions left in `edge-cases.md`

- [ ] State names, and what GitHub actually answers for a deleted or transferred issue. (#487)
- [ ] Retry limits and cooldown values; which integration is used when several can see the repository. (#488)
- [ ] The "retry sync" route and how failed and rate-limited states are exposed. (#489, #491)
- [ ] Per-field timestamps for conflicts: not v1, no owner issue yet.

### Scope, alternatives, compatibility, testing, performance and security

- **In scope:** the matrix `edge-cases.md` (E1…En, seven groups), the consistency edits above, one required test per row. **Out of scope:** code, migrations, endpoints; state names, retry values, routes, UI layouts (owner issues).
- **Alternatives considered:** copy all rows in full (two places to update); placeholder rows only (nothing for #488 to build against); wait for #487 to #491 (blocks the epic order); GitHub wins or Kerghan wins on conflict (silent loss on one side, no timestamp logic); user-decides conflict state (needs API and UI work, #489, #491).
- **Backward compatibility:** documentation only; no existing doc outside `docs/agents/specs/issues*` changes.
- **Testing strategy:** every row is a required test, run in the DB-backed tier where it touches rows (uniqueness, concurrency, transactions) and against a fake GitHub client for sync rows (#494 owns the fixtures); rows already tested in `projects.md` or `model.md` point there instead of repeating.
- **Performance and security:** no new queries or tables. Rows add no credential or content to logs or job params. A `404` never discards a marker without a successful repository read (E22). Jobs make no call for non-approved users (E24).

## Benefits

- Implementation issues and tests (#494) cite stable row ids (`E1…E33` plus the indexed rows) instead of inventing outcomes.
- Cases that cross files (a revoked credential with a pending write, a GitHub issue deleted while a marker exists) have one agreed outcome.
- #487, #488, #490 and #491 start from fixed outcomes and only refine mechanics.

## Acceptance criteria

- `edge-cases.md` is an index with stable row ids, grouped as decided above; every row names its owning file, the check and its status (`Decided` or `Contract`).
- Rows E1 to E33 are written as decided, and the 7 project rows and 16 data rows are indexed as one-liners.
- Its open questions are exactly the four listed above, each with its owner issue (the per-field timestamps item has none yet).
- `sync.md`, `github-link.md`, `security.md`, `model.md`, `ui.md`, `api.md` and the `issues.md` index are updated consistently in the same PR.
- A required test exists per row, citing the row id.
- No code, migrations or endpoints are added.

## Notes

Responsible agent: `architect`. Same shape as the repositories edge-cases matrix (#450). Documentation only, so no change outside `docs/agents/specs/`.
