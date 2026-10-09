# Issue: Prune expired/revoked refresh tokens and stale auth_sessions rows

## Description
Spawned from #319 ("Keep me signed in" sessions). This problem predates #319; its longer-lived sessions make it slightly worse. Three Auth tables grow without bound: `auth_refresh_tokens`, `auth_sessions` and `auth_password_reset_tokens`.

## Problem
- Every login and every refresh (roughly every 15 minutes of activity) inserts a new `auth_refresh_tokens` row. The previous row is only marked `revoked_at` and is never deleted.
- Every mint also inserts an `auth_sessions` row (`TokenService#touchSession`), but **nothing reads that table**. Logoff, refresh and the session list/revoke work (#318) all run on `auth_refresh_tokens` (`session_uuid` / `started_at`), so `auth_sessions` is write-only dead weight.
- `auth_password_reset_tokens` rows (used or expired) are never deleted either.

## Expected Behavior
- `auth_sessions` no longer exists: nothing writes it and the table is dropped.
- When a refresh token is minted (login, register, device authorization or rotation), that user's refresh-token rows whose `expires_at` is in the past are deleted. Revoked but unexpired rows are **kept**, because replay detection needs them.
- When a password-reset token is minted, that user's reset-token rows that are expired or already used are deleted.
- Rows are deleted as soon as they expire. There is no retention/grace window and no new env var.
- Refresh, logoff, replay detection and the session list/revoke behave exactly as before.

## Solution
**Drop `auth_sessions`** (backend):
- Remove `TokenService#touchSession`, the `Session` repository injection, the `Session` entity and its registration in `AuthModule`, and the related spec setup.
- Add a migration that drops `auth_sessions`. Its `down` recreates the table as defined in `20260824120003-auth-create-sessions`.
- Update any docs that describe `auth_sessions`.

**Prune refresh tokens opportunistically, per user** (backend, `TokenService#issueTokens`):
- Before or after saving the new row, run `delete({ userId, expiresAt: LessThan(now) })`. This mirrors the existing `OauthStateService#issue` pattern of deleting expired rows on write. It adds no scheduler and no dependency.
- Why this is safe for replay detection: `AuthService#findActiveRefreshToken` rejects an expired token *before* it checks `revokedAt`/`revokedReason`, so a replayed rotated token only triggers detection while it is unexpired. Deleting rows past `expires_at` therefore does not weaken it.
- Trade-off (accepted): an inactive user's expired rows stay until that user's next mint. The leftover is bounded per user.

**Prune password-reset tokens opportunistically, per user** (backend, `PasswordResetService#issueToken`):
- When a new token is minted, delete that user's rows that are expired (`expiresAt < now`) or used (`usedAt IS NOT NULL`).

**Tests**:
- Expired rows of the minting user are deleted; unexpired revoked rows are kept; other users' rows are untouched.
- A rotated token that is replayed before it expires still triggers replay detection.
- Reset-token pruning removes the user's expired/used rows and leaves their active ones.

## Benefits
- Bounded table growth for the Auth module, which matters more now that long-lived "keep me signed in" sessions exist.
- Removes a write-only table and one insert from every login/refresh.
- No new infrastructure (scheduler, env vars) and no weakening of replay detection.
