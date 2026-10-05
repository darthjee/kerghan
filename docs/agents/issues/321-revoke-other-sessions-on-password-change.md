# Issue: Revoke other sessions on password change

## Description
Part of #318 — "Keep me signed in". Now that long-lived sessions exist, a password change must be able to sign out other sessions.

Current behavior:
- The password-recovery reset (`AuthService#resetPassword`) already revokes all of the user's refresh tokens.
- A self-service password change from **My Account** (`AccountService#updateAccount`) deliberately leaves other sessions active, as its doc-comment says.
- An admin password edit (`AdminService#editUser`) revokes nothing.
- The client keeps its refresh token in `localStorage` and already sends it in the request body for `logoff` and `status`.

## Problem
With "Keep me signed in", a session can stay alive for a long time. A user who changes their password, for example after suspecting a compromise, or an admin who resets a user's password has no way to cut off sessions that are already open.

## Expected Behavior
- **My Account password change** (`PATCH /auth/account.json`): when the password changes, revoke all of the user's other refresh tokens, persistent or not, and keep the current session.
  - The current session is the `refreshToken` the client sends in the request body. This is a new optional field on the account-update request, following the `logoff`/`status` convention.
  - The presented token is kept only if it is an active (unrevoked, unexpired) token that belongs to the caller. If it is missing, unknown, revoked, expired, or belongs to another user, the password still changes and **all** of the user's refresh tokens are revoked (fail safe). The caller is then signed out at their next refresh.
  - Username/email-only changes revoke nothing.
- **Admin password edit:** when an admin sets a user's password, revoke **all** of that user's refresh tokens, with no exception. This also applies when the admin edits their own account through the admin page; admins who want to keep their session use My Account.
- Access tokens that were already issued stay valid until they expire (short TTL). This issue does not add access-token revocation.
- **UI hints** next to the password field:
  - My Account: "Changing the password signs out your other sessions."
  - Admin user edit: "Changing the password signs the user out of all sessions."

## Solution
- Backend: add an optional `refreshToken` to `UpdateAccountDto`. When a My Account password change succeeds, revoke every active refresh token for the user except the presented one, and keep that one only if it passes the checks above. In `AdminService#editUser`, revoke all of the target user's tokens when the password changes. Put the revocation logic in the services and reuse the existing revocation helpers in `AuthService`/`TokenService`. Controllers stay thin.
- Update the `AccountService` doc-comment and any docs that describe the old "other sessions stay active" behavior.
- Frontend: send the stored `refreshToken` with the account-update request, and render both hints.

### Testing
- Jest: a My Account password change revokes the other tokens and keeps the presented one. A missing/foreign/revoked token revokes all. Non-password edits revoke nothing. An admin password edit revokes all, including when the admin edits themselves.
- Jasmine: the account-update request sends the current `refreshToken`, and both hints render.

### Agents
backend, frontend; security review. Independent of the other #318 sub-issues.

## Benefits
Changing a password reliably cuts off other sessions, including long-lived "keep me signed in" ones, without signing the user out of the device they are using.
