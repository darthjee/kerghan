## Description

Split from #58 (see that issue for the full design rationale and the complete sub-issue list).
Depends on #58 sub-issue 2 (entity + `AuthorizationRequestService` + create/poll endpoints).

This is the approver-device half of the login-by-authorization flow: the endpoints an
already-logged-in user calls to see and act on the authorization requests raised against their own
username. The page that drives these is #58 sub-issue 7.

These are the **first authenticated, non-admin routes in the codebase** — they rely on the global
`JwtGuard` (`backend/src/core/jwt.guard.ts`) reading the `access_token` cookie into
`request.user`, with no `@Public()` and no `@AdminOnly()`.

## Problem

- There is no way for the vouching device to list the `open` requests for its own user, nor to
  approve or deny one.
- Approving effectively hands out a new session elsewhere, so it must re-verify the approver
  (Majora re-prompts for the current password); denying is lower-stakes and needs no password.
- Business rejections (wrong password, not the owner, request already resolved) must not surface
  as `401`/`403`, or the frontend `ApiClient` will try to refresh-and-retry and mask the error.

## Expected Behavior

- `POST /auth/authorization-requests/mine.json` (authenticated, body `{}`) →
  `{ requests: [{ uuid, requestIp, requestUserAgent, createdAt, expiresAt }] }` — only the
  caller's own `open`, non-expired requests, newest first. Rows with `user_id = NULL` or a
  different `user_id` are never returned.
- `POST /auth/authorization-requests/:uuid/authorize.json` (authenticated, body `{ password }`) →
  asserts the row belongs to `request.user.sub`, is `open`, is not expired, and
  `bcrypt.compare(password, approver.passwordDigest)` succeeds; on success sets `status =
  approved`, `approved_by_user_id`, `resolved_at`, emits `authorization-request.approved`, returns
  `{ authorized: true }`. Every failure → the same `400 Bad Request`.
- `POST /auth/authorization-requests/:uuid/deny.json` (authenticated, body `{}`) → same
  ownership + `open` assertion, no password; sets `status = denied`, `resolved_at`, emits
  `authorization-request.denied`, returns `{ denied: true }`. Same uniform `400` on failure.
- All three set `X-Skip-Cache: true`.
- An unauthenticated call to any of the three → `401` from the global `JwtGuard` (not a business
  `400`).

## Solution

### Scope

Three authenticated controller routes, the matching `AuthorizationRequestService` methods
(`listOpenForUser`, `authorize`, `deny`), one new DTO, the `approved` / `denied` events, and
wiring. Unit + e2e tests.

Explicitly **out of scope**:

- Rate-limiting / brute-force protection on `authorize` — #58 sub-issue 8.
- The Authorizations page UI — #58 sub-issue 7.
- Any change to the create/poll endpoints from #58 sub-issue 2.

### What needs to be done

- `backend/src/auth/authorization-request.service.ts` — add:
  - `listOpenForUser(userId)` — `WHERE user_id = :userId AND status = 'open' AND expires_at > now`
    ordered `created_at DESC`; map to `{ uuid, requestIp, requestUserAgent, createdAt,
    expiresAt }`.
  - `authorize(uuid, approverUserId, password)` — load row; a missing row, `row.userId !==
    approverUserId`, `status !== 'open'`, past `expires_at`, or a failed `bcrypt.compare` all
    throw the same `BadRequestException` (uniform message). On success update `status` /
    `approvedByUserId` / `resolvedAt` and emit `authorization-request.approved`.
  - `deny(uuid, approverUserId)` — same ownership + `open` assertion, no password; update
    `status` / `resolvedAt`; emit `authorization-request.denied`.
- `backend/src/auth/dto/authorize-authorization-request.dto.ts` — `{ password }`, `@IsString
  @IsNotEmpty`.
- `backend/src/auth/authorization-request.controller.ts` — add the three routes (no `@Public`, no
  `@AdminOnly`); read the approver id from `request.user.sub`; `X-Skip-Cache: true` on each.
- `backend/src/auth/events/authorization-request-approved.event.ts` and `-denied.event.ts`
  (`authorization-request.approved` / `authorization-request.denied`), mirroring the sub-issue 2
  events. No listeners required.
- Tests: extend `authorization-request.service.spec.ts` (list filters out `NULL`/other-user/
  expired/non-open rows; authorize happy path + each uniform-`400` branch; deny happy path +
  branches; events) and `authorization-request.controller.e2e-spec.ts` (401 unauthenticated on
  all three; a user can only see/act on their own requests; wrong approver password → 400;
  authorize then a requesting-side poll returns credentials once; deny then poll returns
  `denied`; `X-Skip-Cache` on every response).

### Acceptance criteria

- [ ] `POST /auth/authorization-requests/mine.json` returns only the caller's own `open`,
      non-expired requests with recorded IP + User-Agent, newest first; `user_id IS NULL` and
      other users' rows are excluded.
- [ ] `POST /auth/authorization-requests/:uuid/authorize.json` requires the approver's correct
      current password and the row to be their own and `open`; on success the row becomes
      `approved` with `approved_by_user_id` set and `authorization-request.approved` emitted.
- [ ] `POST /auth/authorization-requests/:uuid/deny.json` flips the row to `denied` with no
      password and emits `authorization-request.denied`.
- [ ] Wrong password, not-owner and already-resolved all return the same `400` (never
      `401`/`403`); an unauthenticated call returns `401` from `JwtGuard`.
- [ ] After `authorize`, a requesting-side poll (`…/poll.json`) returns credentials exactly once
      (end-to-end e2e with sub-issue 2's endpoint).
- [ ] All three routes set `X-Skip-Cache: true`, asserted in e2e.
- [ ] Service and e2e specs updated and passing; backend lint passes.

## Benefits

- Completes the backend of the device flow: a request can now be raised, approved or denied by
  the right person, and consumed exactly once.
- Introduces the authenticated-non-admin route pattern cleanly against the existing global
  guards, for future modules to follow.
- Keeps rejections as `400` so the frontend error handling stays simple and the `ApiClient`
  refresh path is not triggered spuriously.
