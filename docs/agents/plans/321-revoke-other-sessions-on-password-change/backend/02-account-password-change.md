# Revoke on My Account password change
Add an optional `refreshToken` to `UpdateAccountDto` (`@IsOptional() @IsString()`), with a
doc-comment explaining that it identifies the session to keep on a password change.

In `AccountService`:
- Inject `TokenService`.
- In `updateAccount`, after `applyUserUpdate` succeeds, call
  `this.tokenService.revokeUserTokens(userId, dto.refreshToken)` only when `dto.newPassword` is
  set. Keep it after all guarded checks, so a failed attempt (wrong current password, taken
  username) never revokes anything.
- Rewrite the `updateAccount` doc-comment. Replace the "Leaves other active sessions untouched"
  text with the new rule: a password change revokes the caller's other refresh tokens, keeps
  the presented `refreshToken` when it is the caller's active token, and otherwise revokes all
  of them. Username/email-only changes revoke nothing.
- Update the constructor `@param` list.

Jest (`tests/account.service.spec.ts`, plus `tests/auth.controller.account.e2e-spec.ts` where
the e2e harness makes it practical):
- A password change with the caller's token revokes the other tokens and keeps the presented one.
- A password change with a missing, foreign or unknown token revokes all of the caller's tokens.
- Username/email-only edits revoke nothing, even with `refreshToken` sent.
- Failed validation revokes nothing.

## Files to Change
- `backend/src/auth/dto/update-account.dto.ts` — optional `refreshToken` field.
- `backend/src/auth/account.service.ts` — inject `TokenService`, revoke on password change, rewrite doc-comment.
- `backend/src/auth/tests/account.service.spec.ts` — new specs; add `TokenService` mock to the module setup.
- `backend/src/auth/tests/auth.controller.account.e2e-spec.ts` — e2e coverage of the new body field (if the harness supports it).
