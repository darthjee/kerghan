# Port the unit specs

Both migrated classes are constructed with `new` directly in their specs and currently assert on
`jest.spyOn(Logger.prototype, ...)`. Move those assertions onto an injected `LoggerService`
double. Pattern reference: `backend/src/core/tests/logger.service.spec.ts`.

Shared helper (inline in each spec, or a tiny local factory):
`const logger = { debug: jest.fn(), info: jest.fn(), warn: jest.fn(), error: jest.fn() };`
reset in `beforeEach`.

## `backend/src/mail/tests/mail.service.spec.ts`

- Drop the `import { Logger } from '@nestjs/common'` and the two
  `jest.spyOn(Logger.prototype, ...)` lines.
- Build the `logger` double in `beforeEach`; pass it as the new third arg to every
  `new MailService(transporter as never, <config>)` call (there are several).
- "when email is disabled" test: replace `expect(Logger.prototype.debug).toHaveBeenCalled()` with
  `expect(logger.debug).toHaveBeenCalledWith('email disabled; skipping send', expect.objectContaining({ context: 'MailService', to: 'user@example.com', subject: 'Subject line' }))`.
- "when sendMail rejects" test: the message is now static, so assert on the attributes object:
  - `expect(logger.error).toHaveBeenCalledTimes(1)`
  - `const [, attrs] = logger.error.mock.calls[0]`
  - `expect(attrs.reason).toBe('transport exploded')`
  - `expect(JSON.stringify(attrs)).not.toContain('PLAIN_BODY_SECRET')` and
    `...not.toContain('HTML_BODY_SECRET')` (keep the body-leak guard)
  - the existing `not.toContain('Error:')` guard becomes `expect(attrs.reason).not.toContain('Error:')`
    (still asserting `err.message`, not the raw error, is logged).

## `backend/src/auth/tests/password-recovery-requested.listener.spec.ts`

- Drop the `import { Logger } from '@nestjs/common'` and the `Logger.prototype` spies.
- Build the `logger` double in `beforeEach`; construct the listener as
  `new PasswordRecoveryRequestedListener({ send } as unknown as MailService, logger as never)`.
- "logs one debug line with the messageId and user id":
  `expect(logger.debug).toHaveBeenCalledWith('recovery email sent', expect.objectContaining({ context: 'PasswordRecoveryRequestedListener', userId: 1, messageId: 'mid-1' }))`.
- "resolves without logging" (disabled): `expect(logger.warn).not.toHaveBeenCalled()` and
  `expect(logger.debug).not.toHaveBeenCalled()`.
- "logs one warn line with the user id and the reason":
  assert `logger.warn` called once; `const [, attrs] = logger.warn.mock.calls[0]`;
  `expect(attrs.userId).toBe(1)`; `expect(attrs.reason).toContain('transport exploded')`.
- "never logs the token or the body copy": `const logged = JSON.stringify(logger.warn.mock.calls[0]);`
  then keep the `not.toContain('plain-token-SECRET')` / `not.toContain('can only be used once')`
  assertions.
- "recipient is rejected" test: unchanged except it now checks `logger.warn`.

## Optional (only if it falls out naturally)

If a `mail.module.ts` transport-factory spec is trivial to add (there is none today), a small
`Test.createTestingModule` that overrides `LoggerService` with the double and asserts the boot
`info` call is welcome — but the issue does not require new coverage, so skip it if it needs a
non-trivial harness.

## Files to Change

- `backend/src/mail/tests/mail.service.spec.ts` — replace `Logger.prototype` spies with a
  `LoggerService` double passed into `new MailService(...)`; re-target the disabled/skip and
  send-failed assertions at `logger.debug` / `logger.error` and their attributes.
- `backend/src/auth/tests/password-recovery-requested.listener.spec.ts` — replace `Logger.prototype`
  spies with a `LoggerService` double passed into the listener constructor; re-target the
  sent/not-sent/no-log assertions at `logger.debug` / `logger.warn` and their attributes.
