# Issue: Issues: sync workers

## Description

This is part of the epic #483 (Issues and Projects): Kerghan gets **projects** (optionally connected to one repository) and **issues** that belong to a project and may be linked one to one to a GitHub issue, kept in sync both ways by background workers. The feature is defined as specs under `docs/agents/specs/issues.md` and `docs/agents/specs/issues/*.md` (the lifecycle is in `docs/agents/specs.md`), and the specification phase is finished. This issue builds the **two-way sync**: the `issues.reconcile` background job and everything that triggers it. The specs are the source of truth: this issue makes no product decision of its own, and a change of decision updates the spec in the same PR (`docs/agents/specs.md`, lifecycle step 2). The implementation issues were spawned by #492.

## Builds against

- `docs/agents/specs/issues.md` (the index)
- `docs/agents/specs/issues/sync.md` (all of it)
- `docs/agents/specs/issues/api/github-link.md#trigger-routes`
- `docs/agents/specs/issues/model.md` (marker lifecycle, `issues_pending_writes`)
- `docs/agents/specs/issues/edge-cases.md`: E6 to E11, E13 to E21, E23, E24 (jobs, conflicts, restart, rate limits, credentials), plus the parts handed over by #557: E1 and E2 (the `gone` and `moved` transitions, including the E1 race between an edit and the job that sets `gone`), E22 (the issues probe), E44 (unlink, project or user delete during an in-flight push) and E65 (the rename hand-off on a `301` during a reconcile)

## Depends on

All satisfied (merged on `main`):

- #554 (Issues: GitHub issue client in Integrations)
- #557 (Issues: GitHub link)
- #556 (Issues: issues API), which provides the T1 port
- #479 (background workers)

## Task

- The `issues.reconcile` job (thin: it calls an issues sync service with ids only), the reconcile algorithm and conflict rules, triggers T1 to T6 through the mandatory per-link dedupe, the rate-limit waiting sets and timers, retries and `sync_failed` with its reasons, integration selection, the boot re-enqueue of markers (T5), staleness.
- The `gone` (`deleted`) and `moved` transitions, the E22 probe, and the E65 rename hand-off (retry once at the `Location`, stored owner and name refreshed). Link creation (#557) ignores a `renamedTo` hint; the reconcile is where it is handled.
- The **refresh** (T2, T3) and **retry-sync** (T4) routes, built here and not in the link issue: `/projects/:projectId/refresh.json`, `/projects/:projectId/issues/:issueId/refresh.json` and `.../retry-sync.json`.
- The per-class retry override (`maxRetries`, cooldown) read from the config keys of the foundation issue.
- Update `docs/agents/modules/workers.md` with the job in the same change that registers it.

## Reuse of the ports left by #556 and #557

These are already on `main` with default bindings; this issue swaps the bindings, with no call-site change:

- **T1, `IssueSyncTrigger`** (`backend/src/issues/issue-sync-trigger.ts`): #556 calls `afterCommit(linkIds)` after the edit transaction commits, bound to `NoopIssueSyncTrigger`. Bind the real T1 enqueue (through the per-link dedupe) in its place. The bulk close and reopen (#563) reuses the same port.
- **Waiting sets, `issue-rate-limit-waits.ts`**: the link object (`issue-link-presenter.ts`) reads `rate_limited` and `rateLimitedUntil` through this read port, bound to an empty default. Bind the real in-memory per-integration waiting sets to it.
- **Integration selection, `IssueCandidates`** (`backend/src/issues/issue-candidates.ts`): #557 built the candidates, their order by write capability, the fallback on credential failures only and the aggregate reason. Reuse it, and add the paused-candidate skip (guard 5) and the waiting-set hand-off.

## Acceptance criteria

- The Required tests of every spec file and edge case listed under *Builds against* are implemented, each on the tier given by [`testing.md`](https://github.com/darthjee/kerghan/blob/main/docs/agents/specs/issues/testing.md) (default tier by category and the coverage per area).
- The worker tests of `testing.md#worker-tests`: `FakeWorkersService`, the real-engine specs (registration by name, retry after `_fail`, exhaustion marking `sync_failed`, a rate-limited job finishing without `_fail`) and the restart spec.
- The races of `testing.md#races` (scripted interleaving with deferred answers), including E1 and E44.
- `NoopIssueSyncTrigger` and the empty waiting-sets binding are no longer bound in the Issues module.
- `docs/agents/modules/workers.md` lists the job.
- No decision differs from the specs; if one has to, the spec is updated in the same PR.
- The checks of the owning agent pass.

## Notes

Responsible agent: `backend`.
- Routes: ask the `cache` agent for the cache-class review (`@CachePolicy(CacheClass.UserScoped)`, `X-Skip-Cache`, nothing in Navi), and the `security` and `data-access` agents for the checklists of `docs/agents/specs/issues/security.md#review-checklist`.
- The job runs with a user's credential and writes that user's data: the `security` agent reviews it too.
