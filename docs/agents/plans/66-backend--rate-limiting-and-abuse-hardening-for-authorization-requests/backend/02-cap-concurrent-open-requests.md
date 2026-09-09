# Cap concurrent open requests per user

When `create` resolves a target user (existing `(user_id, status)` index already supports this query),
count that user's current `status = 'open'` rows. If the count is at/over the configured cap (default
e.g. 5), evict the oldest `open` row by setting its `status` to `expired` before inserting the new row —
never reject the create because of this cap, so a legitimate retry always succeeds.

This only applies when the username resolves to a real user; it composes with step 01's rate limiting
(both checks run against the same `create` call, independent of each other) and must not introduce a
distinguishable response/timing difference between "resolved user, cap reached" and "resolved user, cap
not reached" (eviction happens transparently before the normal success response).

Add a `ConfigService`-driven `KERGHAN_AUTHORIZATION_REQUEST_MAX_OPEN_PER_USER`-style key (default
constant + `configService.get`, same convention as step 01).

## Files to Change

- `backend/src/auth/authorization-request.service.ts` — add the concurrent-open count + oldest-eviction
  logic to `create`, and the new config-reading method.
