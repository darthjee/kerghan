# Revoke on admin password edit
In `AdminService`, inject `TokenService`. In `editUser`, after `applyUserUpdate`, call
`this.tokenService.revokeUserTokens(user.id)` (no keep token) only when `dto.newPassword` is
set. There is no special case when the target is the admin: their own sessions are revoked too.
Update the `editUser` doc-comment and the constructor `@param` list.

Jest (`tests/admin.service.spec.ts`):
- A password edit revokes all of the target user's tokens.
- Username/email-only edits revoke nothing.
- Editing your own account as admin also revokes all.

## Files to Change
- `backend/src/auth/admin.service.ts` — inject `TokenService`, revoke on password edit, doc-comment.
- `backend/src/auth/tests/admin.service.spec.ts` — new specs; add `TokenService` mock.
