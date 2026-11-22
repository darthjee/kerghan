# Link rate limiter

Add `IssueLinkRateLimiter`, a per-user, in-memory fixed window driven by the shared `Clock`, built from `IssuesConfig.linkMaxPerWindow` and `linkWindowMs` (defaults 30 per 60000 ms). Import and attach share one window. Unlink is not limited.

- `consume(userId)` returns `{ allowed: true }` or `{ allowed: false, retryAfterMs }`. A refused call consumes nothing. Expired windows are swept, as in `IssueEditRateLimiter`.
- Do not copy the edit limiter's logic. Extract its window bookkeeping into a small shared `FixedWindowRateLimiter` class (`issues/fixed-window-rate-limiter.ts`) that takes `(clock, max, windowMs)` and has a weighted `consume(userId, weight)`. Keep `IssueEditRateLimiter` as a thin injectable subclass, so its spec and its public behaviour stay the same, and make `IssueLinkRateLimiter` the second subclass.
- It is checked after DTO validation and **before** the access check, so a `429` happens before any project lookup.

## Files to Change
- `backend/src/issues/fixed-window-rate-limiter.ts`: new, the shared window logic.
- `backend/src/issues/issue-edit-rate-limiter.ts`: now a subclass, with no change in behaviour.
- `backend/src/issues/issue-link-rate-limiter.ts`: new.
- `backend/src/issues/tests/issue-link-rate-limiter.spec.ts`: the window, a refused call consuming nothing, the reset after the window, separate users kept apart, and the sweep. The existing `issue-edit-rate-limiter.spec.ts` must still pass unchanged.
