# Issue: Backend: list & revoke sessions API

## Description
Part of #318 — "Keep me signed in". Lets users see and revoke their own active sessions.

**Depends on:** #319 (Backend: "Keep me signed in" sessions — the `keepSignedIn` flag on refresh tokens), already merged.

## Problem
Each login mints a refresh token in `auth_refresh_tokens`. Every refresh revokes the token and mints a new row, and nothing links the two rows, so the backend has no idea of a "session" that outlives a rotation. The `auth_sessions` table only does bookkeeping and is not linked to refresh tokens. The client keeps its refresh token in `localStorage` and sends it in the body of `logoff`/`status`.

## Expected Behavior
An authenticated user can list their active sessions, revoke one of them, or revoke every session except the one they are using.

## Solution
### Session identity
- Migration: add an opaque session (family) id, a UUID like `authorization-requests`' `uuid`, and `started_at` to `auth_refresh_tokens`. Set both in `TokenService#issueTokens` for every new login (password, device-auth, register). Carry both over on every rotation, the same way `keepSignedIn` is carried.
- Existing rows get a backfilled UUID of their own (one session each), with `started_at` = `issued_at`.

### Endpoints
Authenticated and user-scoped, on the `auth` controller (`POST`, `.json`). Every endpoint takes `refreshToken` in the body, and the current session is the one whose token matches it (the same convention as `logoff`/`status`/`authorization-requests/mine.json`).
- `POST auth/sessions/mine.json`: lists the caller's active (non-revoked, unexpired) sessions. Each entry has `id` (UUID), started at, last used (the latest rotation, i.e. the active token's `issued_at`), `keepSignedIn` and `current`.
- `POST auth/sessions/:uuid/revoke.json`: revokes one of the caller's sessions. An unknown id, or one owned by another user, returns 404, so existence never leaks. Revoking the current session is allowed and behaves like a logoff.
- `POST auth/sessions/revoke-others.json`: revokes every session except the current one. A missing or invalid current `refreshToken` (unknown, revoked, expired or another user's) returns 401 and revokes nothing. It never falls back to revoking all sessions. Once the token is validated, this can reuse `TokenService#revokeUserTokens(userId, refreshToken)`, since a session has at most one unrevoked token at a time.

### Constraints
- No user agent or IP is captured or shown.
- Never cached: declare the cache class (`CacheClass.Never`) and send `X-Skip-Cache`, per the cache conventions.
- Business logic lives in the Auth module's service. The controller stays thin.
- `auth_sessions` is left untouched.

### Testing
Jest specs:
- the family id and `started_at` are set at login and carried across rotation;
- the list returns only the caller's active sessions, with the current one marked;
- revoking one session works for the caller's own session (including the current one); an unknown id or another user's id returns 404;
- revoking all others keeps only the current session; a missing or invalid current token returns 401 and revokes nothing.

### Agents
backend; data-access, security and cache reviews.

## Benefits
Users can see where they are signed in and cut off sessions they no longer trust. Long-lived "keep me signed in" sessions make that more important.
