# Plan: Header and page need to react to login and logoff

Issue: [35-header-and-page-need-to-react-to-login-and-logoff.md](../../issues/35-header-and-page-need-to-react-to-login-and-logoff.md)

## Overview

Replace `Header.jsx`'s "read `AuthSession.isLoggedIn()` at render time" approach with a
shared `window`-event bus (`AuthEvents`) so the header — and any future component —
reacts to login/logout independently of a page redirect. Add a mount-time confirmation
via a new, genuinely read-only `POST /auth/status.json` backend route (deliberately not
reusing the existing single-use/rotating `refresh.json`, which would reintroduce a
multi-tab session-revocation hazard). Also fix an existing bug where the Register link
never hides when logged in, and add a placeholder Recover link (the recovery feature
itself is out of scope, tracked separately in #36).

## Agents involved

- [backend](backend.md)
- [frontend](frontend.md)

## Shared contracts

**`POST /auth/status.json`** — new, `@Public()`, sets the `X-Skip-Cache` response header
(same convention as every other route in `auth.controller.ts`).

- Request body: `{ "refreshToken": string }` — validated via the existing
  `RefreshTokenDto` (`backend/src/auth/dto/refresh-token.dto.ts`), reused as-is, no new
  DTO needed.
- Response body: `{ "loggedIn": boolean }` — always resolves with `200` and this shape,
  for every case (missing/unknown/expired/revoked token all resolve to
  `{ loggedIn: false }`; a valid, active token resolves to `{ loggedIn: true }`). Never a
  `401`, never sets or clears the `access_token` cookie, never rotates or mutates
  anything in the `refresh_tokens` table — this must not reuse the existing
  `#findActiveRefreshToken` (it calls `#revokeTokenFamily` on a revoked-token hit) or any
  other mutating path.
- Frontend calls this via a new `AccountsClient.status(refreshToken)` method, and skips
  the call entirely (no network request) when `AuthSession.get()` has no stored token.
