# Weighted edit rate limiter

Build `IssueEditRateLimiter`, the per-user issue-edit window from `security.md#request-rate-limits`. It has the same shape as `repositories/repository-add-rate-limiter.ts`:

- an in-memory, per-process fixed window;
- time from the injected `Clock`;
- `editMaxPerWindow` per `editWindowMs` from `IssuesConfig`;
- no table, and it resets on restart;
- expired windows swept at most once per window length.

It differs from the Add limiter in two ways:

- **`consume(userId, weight = 1)`**:
  - when `used + weight > max`, the call is refused with `{ allowed: false, retryAfterMs }` and **nothing is consumed**;
  - otherwise `used += weight`.
  - A fresh or expired window starts at `weight`. A weight above `max` is always refused.
  - #563's bulk call passes `issueIds.length`, and the single edit passes 1.
- **The doc comment names both callers**, the single edit (this issue) and bulk state (#563), and says that refusals consume nothing (E74).

The limiter is not shared with the link limiter (#557), which has its own window.

## Files to Change

- `backend/src/issues/issue-edit-rate-limiter.ts` — the limiter.
- `backend/src/issues/tests/issue-edit-rate-limiter.spec.ts` — unit specs with a fake `Clock`:
  - allows up to `max`, refuses the next one, and gives the right `retryAfterMs`;
  - a refused call leaves the count unchanged, so a lighter call can still pass;
  - weights add up, and `used + weight > max` is refused all-or-nothing;
  - the window resets after `windowMs`;
  - users are independent;
  - expired windows are swept (`trackedUsers()`).
