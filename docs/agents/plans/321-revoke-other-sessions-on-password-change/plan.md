# Plan: Revoke other sessions on password change

Issue: [321-revoke-other-sessions-on-password-change.md](../../issues/321-revoke-other-sessions-on-password-change.md)

## Overview
When a password changes, revoke refresh tokens. A My Account password change revokes every other
refresh token the user has and keeps the presented one. An admin password edit revokes all of
the target user's tokens. The backend adds one revocation method to `TokenService`, which both
services call, plus an optional `refreshToken` field on the account-update request. The frontend
sends the stored refresh token with the account update and shows a hint next to the password
fields on both pages.

## Agents involved

- [backend](backend.md)
- [frontend](frontend.md)

## Shared contracts

- `PATCH /auth/account.json` request body gains an **optional** field `refreshToken: string`
  (same name and convention as `logoff`/`status`). Existing fields are unchanged:
  `{ currentPassword: string, username?: string, email?: string, newPassword?: string,
  refreshToken?: string }`. The response is unchanged: `{ username, email }`.
- Semantics, only when `newPassword` is present and the update succeeds:
  - The token is kept only if it is an active (unrevoked, unexpired) token owned by the caller.
    Every other unrevoked token of the caller is revoked.
  - If the token is missing, unknown, revoked, expired or owned by another user, **all** of the
    caller's tokens are revoked. No error is returned and the password still changes.
- Username/email-only updates never revoke anything, even when `refreshToken` is sent.
- `PATCH /admin/users/:id.json` (`AdminService#editUser`): no contract change. When
  `newPassword` is present, all of the target user's tokens are revoked, including when the
  target is the admin.
- Access tokens that were already issued are not revoked; they expire on their own TTL.
- Security review requested for this issue (refresh token sent in the PATCH body; revocation scope).
