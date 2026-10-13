# Backend Plan: Backend: automatic login as the default user in status.json

Issue: [370-backend-automatic-login-as-the-default-user-in-status-json.md](../../issues/370-backend-automatic-login-as-the-default-user-in-status-json.md)

## Overview
Add the automatic-login path to `status.json`, following the contract in
`docs/agents/specs/default-user/automatic-login.md` (decided by #375) and
`docs/agents/specs/default-user/security.md`. The decision logic lives in the services:
`DefaultUserService` owns "can this caller be logged in as the default user, and with which
session", `AuthService#status` calls it only when there is no active refresh-token row, and
`AuthController#status` only resolves the client IP and sets or clears cookies. Also add the
boot warning.

## Context
- `AuthService#status` (`backend/src/auth/auth.service.ts`) already decides "valid session" from
  the `refresh_token` cookie alone, through `#findActiveTokenRow`, and never revokes. Keep that.
- `TokenService#issueTokens(user, keepSignedIn)` is what `login`/`register` use to create a
  session. Use it with `keepSignedIn: false`.
- `setSessionCookies` (`backend/src/auth/auth-cookies.ts`) sets the three cookies
  `login.json` sets; `clearSessionCookies` is today's logged-out path.
- The client IP is resolved with `extractClientRequestInfo(req, trustedProxyHops)`
  (`backend/src/core/client-request.ts`), with hops read from `KERGHAN_TRUSTED_PROXY_HOPS`
  exactly as `AuthorizationRequestController#trustedProxyHops` does.
- `DefaultUserConfig#isIpAllowed(ip)` already handles loopback defaults, CIDR and
  IPv4-mapped IPv6 (#368).
- `DefaultUserService` (#369) syncs the user at boot (`onApplicationBootstrap`) and holds its
  id in `#defaultUserId`.

## Steps

- [01 — Default-user automatic login and boot warning](backend/01-default-user-auto-login.md)
- [02 — Automatic login in AuthService#status](backend/02-auth-service-status.md)
- [03 — Resolve the client IP and set cookies in AuthController#status](backend/03-auth-controller-status.md)
- [04 — Specs](backend/04-specs.md)

## CI Checks
- `backend`: `docker-compose run kerghan_tests yarn coverage` (CI job: `backend_tests`)
- `backend`: `docker-compose run kerghan_tests yarn lint` (CI job: `backend_checks`)

## Notes
- No navi/cache change: `AuthController` already has `@CachePolicy(CacheClass.Never)`.
- No schema change, no new response field, no frontend change.
- `JwtGuard` must not be touched.
- After implementation, request a review from the `security` agent (authentication logic) and
  the `data-access` agent (authentication/visibility change).
