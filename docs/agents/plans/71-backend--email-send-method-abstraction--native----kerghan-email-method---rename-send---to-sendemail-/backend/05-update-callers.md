# Update callers to sendEmail

Update both existing `MailService.send(...)` callers to `sendEmail(...)`, renaming their local
`text:` param to `body:`. Behaviour is unchanged in both cases — only the call shape moves.

- `backend/src/auth/events/password-recovery-requested.listener.ts`:
  `handlePasswordRecoveryRequested` currently calls
  `this.mailService.send({ to: event.email, subject, text })` (destructured from
  `buildPasswordRecoveryEmail`, which still returns `{ subject, text }` — that builder itself is
  out of scope here, see #70 sub-issue 3). Change the call to
  `this.mailService.sendEmail({ to: event.email, subject, body: text })`. Best-effort
  try/catch and logging (`userId`, never the address/token/subject/body) stay as-is.
- `backend/src/auth/admin.service.ts` (`sendRecoveryEmail`): same shape change,
  `this.mailService.send({ to: user.email, subject, text })` →
  `this.mailService.sendEmail({ to: user.email, subject, body: text })`. The `{ sent: boolean }`
  return derived from `result.status === 'sent'` is unaffected.

Update `password-recovery-requested.listener.spec.ts` and `admin.service.spec.ts`: the
`MailService` test double's method name and assertions move from `send`/`{ text }` to
`sendEmail`/`{ body }`.

## Files to Change

- `backend/src/auth/events/password-recovery-requested.listener.ts` — `send` → `sendEmail`,
  `text:` → `body:`.
- `backend/src/auth/admin.service.ts` — same change in `sendRecoveryEmail`.
- `backend/src/auth/tests/password-recovery-requested.listener.spec.ts` — update the mail double
  + assertions.
- `backend/src/auth/tests/admin.service.spec.ts` — update the mail double + assertions.
