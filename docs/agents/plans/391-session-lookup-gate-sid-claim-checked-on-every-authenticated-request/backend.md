# Backend Plan: Session-lookup gate: sid claim checked on every authenticated request

Issue: [391-session-lookup-gate-sid-claim-checked-on-every-authenticated-request.md](../../issues/391-session-lookup-gate-sid-claim-checked-on-every-authenticated-request.md)

## Overview
Bind every access token to its session with a `sid` claim and turn `JwtGuard` into a
per-request session gate (rules 1 and 2 of
[`docs/agents/specs/user-approval/security.md`](../../specs/user-approval/security.md)), with
`request.user` built from the joined user row.

## Context
- Today `TokenService#issueTokens` (`backend/src/auth/token.service.ts`) signs
  `{ sub, username, isAdmin }` and `JwtGuard` (`backend/src/core/jwt.guard.ts`) only verifies the
  signature (current key, then `KERGHAN_PREVIOUS_SECRET_KEYS`) and assigns the payload to
  `request.user`.
- Every minting path (login, register, refresh, device-authorization poll, auto-login) already
  goes through `issueTokens`; rotation passes the existing `SessionIdentity` so
  `sessionUuid` is copied, and at most one row per session is unrevoked at a time.
- `auth_refresh_tokens.session_uuid` is indexed; `userId` is a logical FK to `auth_users`
  (no TypeORM relation). Both entities belong to `AuthModule`, so joining them is an in-module
  join.
- `core/` never imports `auth/` (see `core/access-token-payload.ts`'s comment); the issue
  decided to keep it that way through a core interface + injection token implemented by auth.
- Backend specs use in-memory repositories (`auth/tests/support/in-memory-repo.ts`), no live DB.

## Steps

- [01 — Add the sid claim](backend/01-sid-claim.md)
- [02 — Session lookup abstraction and auth implementation](backend/02-session-lookup.md)
- [03 — Session gate in JwtGuard](backend/03-jwt-guard-gate.md)
- [04 — Adapt test harnesses](backend/04-test-harnesses.md)
- [05 — Gate tests](backend/05-gate-tests.md)

## CI Checks
- `backend`: `docker-compose run kerghan_tests yarn coverage` (CI job: `backend_tests`)
- `backend`: `docker-compose run kerghan_tests yarn lint` (CI job: `backend_checks`)

## Notes
- Run everything through `docker-compose`, never `yarn` on the host.
- Every new rejection must reuse the existing `UnauthorizedException('Invalid or expired access
  token')` exactly — no new message or error code (non-disclosure groundwork for #392).
- A DB error in the lookup propagates (`500`), never becomes a `401`.
- `sid`-less tokens are rejected with no legacy path; the frontend `ApiClient` refresh-and-retry
  covers the deploy. No frontend change.
- The JWT keeps `username`/`isAdmin` (slimming is out of scope), but nothing may read them for
  authorization any more.
- Leave the documented caveats in `docs/agents/backend/routes/auth.md` and
  `docs/agents/modules/auth.md` alone: #394 rewrites them. Do update JSDoc comments in the
  touched code that would otherwise become wrong (e.g. `AdminGuard`'s "reads the claim off the
  JWT with no DB lookup", `AccessTokenPayload`'s shape description).
- Review: the `security` agent reviews the finished change (it affects every authenticated
  request), and `data-access` may confirm `request.user` exposure is unchanged.
