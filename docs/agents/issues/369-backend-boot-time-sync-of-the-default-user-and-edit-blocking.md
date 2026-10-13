# Issue: Backend: boot-time sync of the default user and edit blocking

## Description

Part of #366. Implements `docs/agents/specs/default-user/boot-sync.md` and the edit-blocking API contract in `docs/agents/specs/default-user/edit-blocking.md` (#374). Builds on `DefaultUserConfig` (#368, `backend/src/auth/default-user.config.ts`).

Two parts:

1. **Boot sync** — at application boot, when `DefaultUserConfig.isEnabled()` is true, make sure the default user exists and matches the environment, and record its id.
2. **Edit blocking** — while `isEnabled()` is true, refuse any API write of the default user's managed fields with `409 DEFAULT_USER_MANAGED`.

## Problem

The `KERGHAN_DEFAULT_USER_*` variables are parsed and validated (#368), but nothing creates or synchronizes the user they describe. Without edit blocking, a rename through the API would make the next boot create a second user (likely colliding on email), email/password edits would be silently reverted at boot, and a password recovery could let whoever controls the configured email take over the (possibly admin) default user until the next boot.

## Expected Behavior

### Boot sync (`isEnabled()` true)

- No user with the configured username exists: create it with the configured username, email, password and admin flag.
- The user exists: overwrite its email, password and admin flag. The environment is the source of truth.
- The password digest is rehashed and updated **only** when the configured password differs from the stored one (`bcrypt.compare`).
- When the password actually changes, the user's existing sessions are revoked with `RevokedReason.ADMIN_PASSWORD_CHANGE`.
- The configured email belongs to another user (different username): boot fails with a clear error.
- Creating the user hits the unique constraint (several instances booting at once): fall through to the update path.
- Boot sync records the **id** of the row it created or matched; that id is what identifies the default user (never a username string comparison, because `auth_users.username` uses MySQL's case/accent-insensitive collation).

### Disabled (`isEnabled()` false)

Nothing happens at boot, no id is held, nothing is blocked. A default user created by an earlier boot stays untouched and becomes an ordinary editable user.

### Edit blocking (`isEnabled()` true)

- Managed fields: `username`, `email`, `newPassword` (the admin flag too, if an endpoint ever edits it).
- Rule is **per field, by presence**: a request targeting the default user that contains any managed field is rejected, even when the value equals the stored one. No value comparison, no `bcrypt.compare`.
- Response: `409 Conflict`, code `DEFAULT_USER_MANAGED` (added to `ErrorCodes` in `backend/src/core/error-codes.ts`), message `This user is managed by environment configuration and cannot be edited`, standard body, no `error.details`.
- `PATCH /auth/account.json`: the block runs right after `assertAnyFieldPresent` and before the lockout check, comparing the session `userId` with the default user id. It never checks `currentPassword`, never calls `registerFailure`, and leaves an existing lockout row untouched; a locked-out default user gets `409`, not `423`.
- `POST /admin/users/:id/edit.json`: after `assertAnyFieldPresent` and the `404` load, before availability checks. Applies even when the default user is the admin editing itself.
- `POST /auth/recover.json`: for the default user's email, unchanged `200 { sent: true }`; no token, no email.
- `POST /auth/reset-password.json`: token validated first (existing errors unchanged); a valid token for the default user → `409`, password unchanged, token not consumed.
- `POST /admin/users/:id/recovery-link.json` and `send-recovery-email.json`: after the existing `404` → `409`; no token, no email.
- Blocking logic lives in the services (`AccountService`, `AdminService`, `PasswordResetService`), never in the controllers.
- Feature off: every endpoint behaves exactly as today; existing tests stay unchanged. No migration, no frontend change.

## Solution

- A boot-sync component in the auth module that runs once the app boots (e.g. a Nest lifecycle hook), uses the existing user/session services to create or update the user and revoke sessions, and holds the resolved default-user id.
- An `isDefaultUser(userId)` helper on that component (false when disabled or no id held), injected into `AccountService`, `AdminService` and `PasswordResetService` to apply the block at the documented points in their check order.
- Jest specs covering every case listed under "Required tests" in both `boot-sync.md` and `edit-blocking.md`: create, update, unchanged password (no rehash, no revocation), changed password (rehash + revocation), email collision, unique-constraint race, disabled flag, recorded id; blocked edits through `account.json` and the admin endpoint (including equal values, no `currentPassword` check, no abuse-guard interaction, lockout precedence), recovery/reset/recovery-link/send-recovery-email behavior, case/accent-insensitive identity by id, other users still editable, and disabled-feature parity.

## Benefits

- The default user always matches the environment, safely across concurrent instance boots.
- Managed fields cannot drift or be hijacked through the API, with a stable, documented error the frontend already surfaces.
