# Backend Plan: Backend: rate-limiting and abuse hardening for authorization requests

Main plan: [plan.md](plan.md)

## Overview

The device-authorization flow (`AuthorizationRequestService`, `backend/src/auth/`) already persists the
requester's IP (`request_ip`) and has an `expired` status; `authorize` already returns a uniform
`BadRequestException` (`AUTHORIZE_FAILURE_MESSAGE`) for every failure branch, including a `DUMMY_DIGEST`
timing-safe compare when no approver row exists. No rate-limiting mechanism, `@nestjs/throttler` dependency,
or shared cache (Redis or similar) exists in the backend today — confirmed during investigation — so all
limits here are implemented as in-service counting against MySQL rows, with no new always-on
infrastructure.

## Context

`create` is unauthenticated and unthrottled (unbounded rows per IP/username, and a victim's Authorizations
page can be flooded with `open` rows); `authorize` has no attempt limit, letting a compromised-but-locked
device brute-force the approver's password. Per-IP limiting further depends on trusting
`X-Forwarded-For`, which Tent's `SetClientIpMiddleware` sets correctly today — but the backend's own
container port is also mapped directly to the host, so a client bypassing Tent could otherwise spoof it;
the backend must validate the trusted-hop count itself rather than relying on network topology.

Every new rejection/limit path must preserve the codebase's existing bar: identical status/message and
equivalent cost/timing across every outcome (normal vs. any limited/locked path), so no new enumeration or
timing side channel is introduced.

## Steps

- [01 — Rate-limit create per IP and per username](backend/01-rate-limit-create.md)
- [02 — Cap concurrent open requests per user](backend/02-cap-concurrent-open-requests.md)
- [03 — Cool-off on repeated authorize failures](backend/03-authorize-cooloff.md)
- [04 — Harden client-IP trust and DTO length caps](backend/04-harden-ip-trust-and-dto-limits.md)
- [05 — Tests for all new limits](backend/05-tests.md)

## CI Checks

- `backend`: `npm run coverage` (CI job: `backend_tests`)
- `backend`: `npm run lint` (CI job: `backend_checks`)

## Notes

- Decide the exact config key names during implementation (candidates in the issue:
  `KERGHAN_AUTHORIZATION_REQUEST_CREATE_LIMIT`/`_CREATE_WINDOW_MS`,
  `KERGHAN_AUTHORIZATION_REQUEST_MAX_OPEN_PER_USER`,
  `KERGHAN_AUTHORIZATION_REQUEST_AUTHORIZE_MAX_ATTEMPTS`/`_AUTHORIZE_LOCK_MS`,
  `KERGHAN_TRUSTED_PROXY_HOPS`), following the existing `configService.get('KERGHAN_*', DEFAULT_CONST)`
  convention (see `#ttlMs()` in `authorization-request.service.ts`). Document defaults for #58 sub-issue 9.
- Decide during implementation whether the over-limit `create` response is a throwaway-row `{ uuid,
  pollToken, expiresAt }` or a uniform `429` applied identically to known/unknown usernames — either is
  acceptable as long as it's enumeration-safe and equivalent-cost across paths.
- Out of scope: a general-purpose rate-limiting framework, physical purge of old resolved rows (separate
  #58 follow-up), frontend copy changes, and deployment/network-level fixes (the backend hardens itself
  instead — see step 04).
