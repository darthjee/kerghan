# Backend Plan: Prune expired/revoked refresh tokens and stale auth_sessions rows

Issue: [325-prune-expired-revoked-refresh-tokens-and-stale-auth-sessions-rows.md](../../issues/325-prune-expired-revoked-refresh-tokens-and-stale-auth-sessions-rows.md)

## Overview
Three Auth tables grow without bound:
- `auth_sessions` is never read, so it is removed entirely.
- `auth_refresh_tokens` and `auth_password_reset_tokens` are pruned opportunistically and per user, whenever a new token is minted for that user. This follows the existing `OauthStateService#issue` pattern of deleting expired rows on write.

There is no scheduler, no new environment variable and no retention/grace window.

## Context
- `TokenService#touchSession` is the only code that touches `auth_sessions` (an insert on every mint). Logoff, refresh and the session list/revoke all run on `auth_refresh_tokens` (`session_uuid` / `started_at`).
- Replay detection is safe: `AuthService#findActiveRefreshToken` rejects an expired token *before* it checks `revokedAt`/`revokedReason`. Deleting rows past `expires_at` therefore cannot weaken replay detection. Revoked but unexpired rows must be kept.
- The in-memory test repository (`backend/src/auth/tests/support/in-memory-repo.ts`) supports neither `delete` nor the `LessThan` operator yet.

## Steps

- [01 — Drop auth_sessions](backend/01-drop-auth-sessions.md)
- [02 — Prune expired refresh tokens on mint](backend/02-prune-refresh-tokens.md)
- [03 — Prune expired/used password-reset tokens on mint](backend/03-prune-password-reset-tokens.md)
- [04 — Update docs](backend/04-update-docs.md)

## CI Checks
- `backend`: `docker-compose run --rm kerghan_app yarn coverage` (CI job: `backend_tests`)
- `backend`: `docker-compose run --rm kerghan_app yarn lint` (CI job: `backend_checks`)

## Notes
- An inactive user's expired rows stay until that user's next mint. The issue accepts this trade-off, since the leftover is bounded per user.
- Pruning runs on the request path (login/rotation/recover). The deletes are filtered by `user_id`, which is already indexed on both token tables, so they stay cheap.
- The migration's `down` recreates `auth_sessions` empty. The data it held is not recoverable, and nothing reads it.
