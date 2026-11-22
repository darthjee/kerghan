# Plan: Issues: sync workers

Issue: [558-issues-sync-workers.md](../../issues/558-issues-sync-workers.md)

## Overview

Build the two-way sync of `docs/agents/specs/issues/sync.md`: the `issues.reconcile` job and its sync service, triggers T1 to T6 behind a per-link dedupe, the per-integration rate-limit pauses, waiting sets and timers, retries and `sync_failed`, and the T2, T3 and T4 trigger routes. It also replaces the default bindings of the ports #556 and #557 left (`IssueSyncTrigger`, `IssueRateLimitWaits`). All the work is in `backend/`.

See [backend.md](backend.md) for the full plan.
