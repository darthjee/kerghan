# Tests

Extend the existing unit and e2e spec files for the authorization-request feature — do not create
new spec files. Follow the mocking/in-memory-repo patterns already established in each file.

## Files to Change

- `backend/src/auth/tests/authorization-request.service.spec.ts`:
  - `describe('listOpenForUser', ...)`: returns only `open`, non-expired rows for the given
    `userId`; excludes `userId: null` rows, other users' rows, non-`open` statuses, and expired
    rows; orders newest first; maps to `{ uuid, requestIp, requestUserAgent, createdAt, expiresAt
    }` only (no `id`/`pollTokenHash`/`username`/`approvedByUserId` leakage).
  - `describe('authorize', ...)`: happy path sets `status: 'approved'`, `approvedByUserId`,
    `resolvedAt`, and emits `authorization-request.approved`; one `describe` per uniform-`400`
    branch (missing row, not the owner, not `open`, expired, wrong password) each asserting
    `BadRequestException` with the same message and that no event was emitted.
  - `describe('deny', ...)`: happy path sets `status: 'denied'`, `resolvedAt`, and emits
    `authorization-request.denied`; branches for not-owner and not-`open` asserting the same
    `BadRequestException`; assert no expiry check is performed (an expired-but-open row still
    denies successfully).
  - Extend `repoMock`/add a `find` mock as needed for `listOpenForUser`; reuse the existing
    `userRepository` mock (add `findOneBy` return values for the approver row with a real bcrypt
    hash, e.g. via `bcrypt.hashSync('approver-password', 10)`).

- `backend/src/auth/tests/authorization-request.controller.e2e-spec.ts`:
  - Register two users in `beforeEach` (an owner and an unrelated "attacker" account) and log the
    owner in via `POST /auth/login.json` to obtain the `access_token` cookie, following
    `admin.controller.e2e-spec.ts`'s `set-cookie` extraction pattern.
  - `describe('mine')`: unauthenticated → `401`; returns only the owner's own `open`, non-expired
    requests with `requestIp`/`requestUserAgent`; a request belonging to the attacker or with
    `userId: null` is never returned.
  - `describe('authorize')`: unauthenticated → `401`; wrong password → `400`; the attacker
    authorizing the owner's request → `400`; correct password → `200 { authorized: true }`, and a
    subsequent requesting-side `poll.json` call (reusing the existing full-poll-flow helpers)
    returns credentials exactly once.
  - `describe('deny')`: unauthenticated → `401`; the attacker denying the owner's request → `400`;
    owner denying → `200 { denied: true }`, and a subsequent `poll.json` call returns `{ status:
    'denied' }`.
  - `describe('X-Skip-Cache header')`: asserted on `mine`, `authorize`, and `deny` responses.
