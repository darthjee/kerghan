# Plan: Implement password recovery flow

Issue: [36-implement-password-recovery-flow.md](../../issues/36-implement-password-recovery-flow.md)

## Overview

Add a self-service password recovery flow to the existing `auth` module: `POST
/auth/recover.json` (always `200 { sent: true }`, enumeration-safe) and `POST
/auth/reset-password.json` (single-use, time-limited token; uniform `400` error on any
rejection reason), backed by a new `PasswordResetToken` entity that mirrors the existing
`RefreshToken` model. On success, all of that user's other refresh tokens are revoked. Email
sending is explicitly out of scope (split into #38/#39) — `recover.json` only fires a
`PasswordRecoveryRequestedEvent`, unconsumed here. The frontend gets two new pages
(`Recover`, `ResetPassword`) following the existing `Login`/`Register` conventions, plus the
two new hash routes that the placeholder header link from #35 already points at.

## Agents involved

- [backend](backend.md)
- [frontend](frontend.md)

## Shared contracts

- **`POST /auth/recover.json`** — request `{ email: string }`; response always `200 { sent:
  true }`, regardless of whether `email` matches an account. `frontend` never branches on the
  response body/status for this call — it always shows the same "check your email" state,
  including on network/server errors (see `frontend.md`).
- **`POST /auth/reset-password.json`** — request `{ token: string, password: string,
  password_confirmation: string }` (`password_confirmation` is accepted but not validated
  server-side — stripped by the global `ValidationPipe`'s `whitelist: true`, same as
  `RegisterDto` today; equality is a client-side-only UX check). Response `200 { reset: true }`
  on success. On **any** rejection reason (unknown token, already-used token, expired token,
  password fails `@MinLength(8)`), the status is **`400`** — not `401`. This is a corrected
  decision from an earlier draft of the issue: `frontend`'s shared `ApiClient#sendJson`
  (`frontend/assets/js/client/ApiClient.js:60-64`) intercepts every `401` app-wide to attempt an
  access-token refresh-and-retry, which would swallow/misroute this logged-out flow's error
  entirely. `backend` must use `400`, never `401`, for every reset-password failure path.
- **Recovery link shape**: `${FRONTEND_BASE_URL}/#/recover-password?token=<token>` — `backend`
  builds this exact string (via `ConfigService.get('FRONTEND_BASE_URL')`, already declared in
  `.env.dev.sample` but unused today) as the `resetUrl` field of the
  `PasswordRecoveryRequestedEvent` payload (consumed later by #39, not by this issue's own
  code). `frontend` independently registers the hash path `/recover-password` with a `token`
  query param in `HashRouteResolver.js`. The path segment `recover-password` and query key
  `token` must stay identical between the two — there is no shared constant enforcing this
  today (`backend` and `frontend` are separate `package.json`s), so both sides implement it
  from this plan's literal string, not from each other's code.
- **Error message wording caveat**: `backend` throws `BadRequestException('Invalid or expired
  token')`, but `frontend`'s `ApiClient` currently reads `data.error` from the response body,
  while NestJS's default (unfiltered) exception shape puts the message in `data.message` and a
  generic status label (`"Bad Request"`) in `data.error` — a pre-existing mismatch tracked
  separately as #42. `frontend`'s `ResetPassword` page should just render whatever
  `ApiClient`/`ApiError` surfaces as `error.message`, the same way `LoginController`/
  `RegisterController` already do; it is not blocked on #42 and needs no special-casing.
- **Session revocation side effect**: `backend`'s `reset-password.json` calls the existing
  private `AuthService#revokeTokenFamily(userId)` (today only used for refresh-token replay
  detection) after a successful reset. This has no `frontend` contract of its own — the
  currently-submitting browser has no stored refresh token for this flow anyway (see
  `AccountsClient.recover`/`resetPassword` below) — it only affects *other* already-logged-in
  sessions for that user, which will hit their own `401`/refresh failure on their next request,
  handled by `frontend`'s existing generic session-expiry flow.
