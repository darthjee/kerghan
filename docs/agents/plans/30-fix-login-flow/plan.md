# Plan: Fix login flow

Issue: [30-fix-login-flow.md](../issues/30-fix-login-flow.md)

## Overview

Align the frontend and backend auth surface end to end: rename the backend's logout route to a
proper `DELETE /auth/logoff.json`, make the access-token lifetime configurable, and build out
the frontend auth flow (which today only has a partially-broken Register page and nothing else)
— Login, Logout, reactive token refresh, and an auth-aware header — plus bring the existing auth
docs up to date with all of it.

## Agents involved

- [backend](backend.md)
- [frontend](frontend.md)

## Shared contracts

- **`DELETE /auth/logoff.json`** (renamed from `POST /auth/logout.json`, removed outright — no
  alias): request body `{ refreshToken: string }` (same `RefreshTokenDto` as today), response
  `204 No Content`, clears the `access_token` cookie. Same behavior as today's logout, only the
  HTTP method and path change. `frontend`'s `AccountsClient.logout` must call this exact
  method/path.
- **`POST /auth/login.json`, `POST /auth/register.json`, `POST /auth/refresh.json`** — response
  shape is unchanged: `{ user: { id, username, email }, refreshToken: string }` in the JSON
  body, plus an httpOnly `access_token` cookie set on the response (auto-sent by the browser on
  subsequent requests). `frontend` persists only `refreshToken` (in `localStorage`); it never
  reads or writes the `access_token` cookie directly.
- **`401` on an expired/invalid access token or refresh token** — already true today
  (`JwtGuard` for the access token; `AuthService#refresh` for the refresh token via
  `UnauthorizedException`). No backend behavior change required for this; `frontend`'s
  `ApiClient` relies on this existing contract to drive its reactive refresh-then-retry and
  session-expired handling.
- `KERGHAN_ACCESS_TOKEN_TTL_MS` (new env var) is backend-internal only — not consumed by the
  frontend, so it is not a shared contract between the two agents.
