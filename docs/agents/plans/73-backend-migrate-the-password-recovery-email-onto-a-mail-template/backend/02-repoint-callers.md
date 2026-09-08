# Repoint the listener and admin service onto `sendEmailTemplate`

Switch both call sites from `buildPasswordRecoveryEmail(...)` + `mailService.sendEmail({ to,
subject, body })` to `mailService.sendEmailTemplate({ to, template: 'password-recovery',
variables: { resetUrl } })`, then delete the helper. Behaviour around each call is unchanged.

## `password-recovery-requested.listener.ts`

- Remove the `buildPasswordRecoveryEmail` import.
- Drop `const { subject, text } = buildPasswordRecoveryEmail(event.resetUrl);`.
- Replace the send with:
  ```ts
  const result = await this.mailService.sendEmailTemplate({
    to: event.email,
    template: 'password-recovery',
    variables: { resetUrl: event.resetUrl },
  });
  ```
- Keep everything else: the `try/catch`, `result.status === 'sent'` → one `debug` line with
  `userId` + `messageId`, `{ status: 'skipped' }` → silent success, `catch` → one `warn` line
  with `userId` + `reason` only (never the address, token, url, subject, or body).
- Update the class JSDoc: it "renders the `password-recovery` mail template and sends it via
  `MailService.sendEmailTemplate`" instead of "builds the plain-text recovery email (via
  `buildPasswordRecoveryEmail`)".

## `admin.service.ts` — `sendRecoveryEmail`

- Remove the `buildPasswordRecoveryEmail` import (line 5).
- Drop `const { subject, text } = buildPasswordRecoveryEmail(resetUrl);` (line ~86).
- Replace the send with:
  ```ts
  const result = await this.mailService.sendEmailTemplate({
    to: user.email,
    template: 'password-recovery',
    variables: { resetUrl },
  });
  ```
- Keep `return { sent: result.status === 'sent' };` and `catch { return { sent: false }; }` —
  still `await`ed synchronously so the admin route returns a real `sent: true/false` (`false`
  covers disabled mail and a thrown send error, never a `500`).

## Delete the helper

- Delete `backend/src/auth/events/password-recovery-email.content.ts`.
- Update the doc comment in `backend/src/auth/events/password-recovery-requested.event.ts`
  (line ~6) that references `password-recovery-email.content.ts` so no dangling reference
  remains (e.g. "the listener renders the `password-recovery` mail template").

## Files to Change

- `backend/src/auth/events/password-recovery-requested.listener.ts` — swap to
  `sendEmailTemplate`, drop the helper import, update JSDoc.
- `backend/src/auth/admin.service.ts` — same swap in `sendRecoveryEmail`, drop the helper import.
- `backend/src/auth/events/password-recovery-email.content.ts` — delete.
- `backend/src/auth/events/password-recovery-requested.event.ts` — update the stale doc-comment
  reference to the deleted helper.
