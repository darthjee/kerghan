# Cool-off on repeated authorize failures

Track failed `authorize` attempts per authorization-request row (the row already carries `uuid`,
`approved_by_user_id`, etc., so tracking per-request keeps the mechanism scoped to the same row without a
new table). Add a migration on `auth_authorization_requests`:
- `authorize_failed_attempts` (int, default `0`)
- `authorize_locked_until` (nullable timestamp)

Follow the existing migration file/naming convention (see
`backend/src/database/migrations/20260903120008-auth-create-authorization-requests.ts`) and update the
entity (`backend/src/auth/entities/authorization-request.entity.ts`) with the two new columns.

In `AuthorizationRequestService.authorize`:
- If `authorize_locked_until` is set and in the future, reject immediately with the same uniform `400`
  (`AUTHORIZE_FAILURE_MESSAGE`) — but still perform the existing `#verifyApproverPassword` /
  `DUMMY_DIGEST` timing-safe compare (or an equivalent-cost no-op) before returning, so a locked-out
  attempt is not measurably faster than a normal wrong-password attempt.
- On a wrong-password failure, increment `authorize_failed_attempts`; once it reaches the configured
  max-attempts threshold, set `authorize_locked_until = now + <lock_ms>` (both `ConfigService`-driven,
  default constants + `configService.get`, same convention as prior steps).
- On success, reset `authorize_failed_attempts` to `0` and clear `authorize_locked_until` (defensive —
  a resolved/approved row won't be retried, but keeps the row's state consistent for any read paths).

Every rejection branch (missing row, wrong owner, wrong status, expired, wrong password, locked-out)
must keep returning the exact same status/message.

## Files to Change

- `backend/src/database/migrations/<timestamp>-auth-add-authorize-lockout-columns.ts` — new migration
  adding `authorize_failed_attempts` and `authorize_locked_until`.
- `backend/src/auth/entities/authorization-request.entity.ts` — add the two new columns.
- `backend/src/auth/authorization-request.service.ts` — add the lock-check, dummy-cost-on-lock,
  attempt-increment, and lock-trip logic to `authorize`; add the new config-reading methods.
