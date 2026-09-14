# Issue: Backend: brute-force lockout protection for PATCH /auth/account.json

## Description

`PATCH /auth/account.json` (issue #88) lets a logged-in user update their own `username`,
`email`, and/or `password` by supplying their `currentPassword`. Because the endpoint is
authenticated (not `@Public()`), the realistic threat model for repeated wrong `currentPassword`
guesses is an attacker who already holds a stolen/leaked access token but not the account
password, and is trying to fully take over the account (or lock the owner out) via this endpoint.

Issue #66 already added rate-limiting/abuse hardening (`AuthorizationRequestAbuseGuardService`,
a per-row failed-attempt counter with a timed lockout, config-driven via
`KERGHAN_AUTHORIZATION_REQUEST_AUTHORIZE_MAX_ATTEMPTS`/`_LOCK_MS`) for the public
authorization-request endpoint. This issue was deliberately deferred out of #88's scope to keep
that issue focused on the core edit flow, but the same class of protection should exist here too.

## Problem

- `PATCH /auth/account.json` has no limit on repeated failed update attempts (wrong
  `currentPassword`, or other validation failures like a duplicate `username`/`email`), letting an
  attacker holding a stolen access token brute-force the account password — or otherwise hammer
  the endpoint — via unlimited retries.

## Solution

- Add an abuse-guard mechanism for `PATCH /auth/account.json`, conceptually mirroring the pattern
  in `AuthorizationRequestAbuseGuardService`
  (`backend/src/auth/authorization-request-abuse-guard.service.ts`) — a per-user failed-attempt
  counter and a timed lockout after too many failed attempts — but implemented as its own
  service/table, since the existing guard's repository is hardcoded to
  `Repository<AuthorizationRequest>` and isn't directly reusable.
- **Storage**: a new dedicated tracking table (e.g. `auth_account_edit_lockouts`), keyed by
  `user_id` (logical FK to `auth_users`, matching the codebase's existing logical-FK convention —
  see `docs/agents/architecture/backend.md`'s "Owned tables" section), holding the failed-attempt
  counter and `locked_until` timestamp — rather than adding columns directly to the `User` entity.
- **Counter scope**: increment on *any* failed `PATCH /auth/account.json` validation attempt for
  the authenticated user — wrong `currentPassword`, duplicate `username`, duplicate `email`, etc.
  — not just `currentPassword` mismatches.
- **Reset condition**: clear the counter/lockout on a successful account update, same as the
  existing pattern (`authorization-request.service.ts` resets both fields inline when a request
  moves to `approved`).
- **Locked-out response**: return a distinct "account locked" error (e.g. `423 Locked` or a
  dedicated error code/message) rather than the generic wrong-`currentPassword` error — since the
  caller is already authenticated as this exact user (JWT-protected, not anonymous), there's no
  enumeration risk in telling them they're locked out and for how long.
- Config-driven the same way as the existing pattern, with new env vars following the established
  `KERGHAN_<SCOPE>_<PARAM>` naming convention (e.g.
  `KERGHAN_ACCOUNT_EDIT_MAX_ATTEMPTS`/`KERGHAN_ACCOUNT_EDIT_LOCK_MS`).
- New backend tests covering the lockout, its expiry, and the broadened failure-counting scope.

## Benefits

- Closes the gap between the authorization-request endpoint's abuse hardening (#66) and this
  newer self-service account-edit endpoint, consistent with the codebase's existing security
  posture.
- The broader failure-counting scope also throttles other abuse patterns against this endpoint
  (not just password guessing), and the distinct locked-out response gives a legitimately
  locked-out user clear feedback instead of a misleading "wrong password" message.
