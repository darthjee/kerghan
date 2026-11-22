# Rate-limit pauses, waiting sets and timers

Implement `sync.md#rate-limits` as an in-memory provider, for example `IssueRateLimitPauses`. It is the real binding of the existing `IssueRateLimitWaits` read port, which replaces `EmptyIssueRateLimitWaits`.

- **Pause:** a pause per integration id holds the reset time. The time comes from `resetAt`, or `now + 60 s` when `resetAt` is `null`.
- **Waiting set:** one per integration, deduplicated link ids. `untilFor(linkIds)` returns each waiting link's reset time.
- **Timer:** one per integration, through the injected `Scheduler`. At the reset it enqueues one `issues.reconcile` per waiting link through the per-link dedupe (step 05), then clears the pause and the set. A later pause for the same integration reschedules the timer rather than adding a second one.
- **Queries for guard 5:**
  - `isPaused(integrationId)`.
  - The earliest-reset candidate when every candidate is paused.
- **Restart:** nothing persists, so pauses and waiting sets are lost on restart (E16).

Unit-spec it with `FakeClock` and `FakeScheduler`, including the presenter now showing `rate_limited` with `rateLimitedUntil`.

## Files to Change

- `backend/src/issues/issue-rate-limit-pauses.ts` (new) and spec
- `backend/src/issues/issues.module.ts`: bind `IssueRateLimitWaits` to it
- `backend/src/issues/issue-link-presenter.ts`: no call-site change expected; add a spec case
