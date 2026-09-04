# Add AdminService

New file `backend/src/auth/admin.service.ts`, `AdminService` — the business logic behind the
three admin endpoints, constructor-injected with the `User` repository, `PasswordResetService`,
and `MailService` (direct DI, same module — no cross-module boundary to cross).

- `searchUsers(q?: string): Promise<User[]>` — when `q` is present, match `username` or `email`
  case-insensitively (e.g. TypeORM `Like`/`ILike` on both fields via a `where: [...]` array,
  matching `#assertAvailable`'s existing two-condition style in `auth.service.ts`); when absent,
  return all users (no pagination needed for #41's scope). Never include `passwordDigest` —
  serialization to the public shape happens in the controller (step 04), matching
  `AuthController#serialize`'s existing pattern.
- `#findUserOrThrow(id: number): Promise<User>` — private helper, throws `NotFoundException` when
  no user matches; used by both actions below.
- `generateRecoveryLink(userId: number): Promise<{ resetUrl: string }>` — find the user (or
  throw), call `passwordResetService.issueToken(user)`, return `{ resetUrl }`. Never invalidates
  the user's other tokens, per the extracted `issueToken` behavior.
- `sendRecoveryEmail(userId: number): Promise<{ sent: boolean }>` — find the user (or throw), call
  `passwordResetService.issueToken(user)`, build the email via the existing
  `buildPasswordRecoveryEmail(resetUrl)` (`./events/password-recovery-email.content.js`), then
  call `mailService.send({ to: user.email, subject, text })` directly (no event emission — this
  is the "synchronous, real feedback" path from the discuss-issue dialogue). Return `{ sent: true
  }` when `result.status === 'sent'`, `{ sent: false }` for `'skipped'` or a thrown error (catch
  it here — don't let a mail-provider failure surface as a `500` to the admin).

## Files to Change

- `backend/src/auth/admin.service.ts` — new file.
- `backend/src/auth/tests/admin.service.spec.ts` — new unit spec: user-found/not-found paths for
  both actions, mail `sent`/`skipped`/throwing paths for `sendRecoveryEmail`, and `searchUsers`
  with/without a query.
