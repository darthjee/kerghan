# The `issues.reconcile` job, dedupe and triggers T1, T5, T6

- **Job:** `issues/jobs/issues-reconcile.job.ts`, a deku-swarm `Job` with `{ linkId }` params and the sync service injected as an attribute.
  - Override the `maxRetries` and `cooldown` getters from `IssuesConfig` (5 and 30 s).
  - Keep a private attempt counter, incremented at the start of each `perform()`, and pass `lastAttempt = attempts >= maxRetries`.
  - Map the outcome:
    - `done`, `stopped` and `rate_limited`: finish cleanly.
    - `requeue`: enqueue a fresh job through the dedupe, then finish.
    - `transient`: `_fail`.
- **Registration:** the Issues module registers `issues.reconcile` on init through `WorkersService.register`.
- **Per-link dedupe:** `IssueSyncQueue.enqueue(linkId)`. While a link is queued and not started, enqueuing it again is a no-op; the link leaves the queued set when its job starts. Every trigger and the rate-limit timer go through it.
- **T1:** replace `NoopIssueSyncTrigger` with a real `IssueSyncTrigger` whose `afterCommit(linkIds)` enqueues each link through the dedupe. The bulk close and reopen (#563) will reuse it.
- **T5:** at `onApplicationBootstrap`, enqueue one reconcile per marker, oldest `marked_at` first, with no filtering.
- **T6:** comes from the `requeue` outcome above.

Spec it with `FakeWorkersService`: registration by name, params `{ linkId }` only (exact key allowlist), dedupe, T1 after commit only, T5 order, T6, and the outcome mapping.

## Files to Change

- `backend/src/issues/jobs/issues-reconcile.job.ts` (new) and spec
- `backend/src/issues/issue-sync-queue.ts` (new) and spec
- `backend/src/issues/issue-sync-trigger.ts`: the real trigger (the Noop class stays only if a spec still needs it)
- `backend/src/issues/issues-sync.bootstrap.ts` (new, or in the module): registration and T5
- `backend/src/issues/issues.module.ts`: bindings
