# `password-recovery.requested` listener

The `@OnEvent` handler that ties the event (step 01) to the builder (step 02) and `MailService`.
Lives in the Auth module, next to the event payload class.

## What to do

Create `backend/src/auth/events/password-recovery-requested.listener.ts`:

```ts
@Injectable()
export class PasswordRecoveryRequestedListener {
  private readonly logger = new Logger(PasswordRecoveryRequestedListener.name);
  private readonly mailService: MailService;

  constructor(mailService: MailService) {
    this.mailService = mailService;
  }

  @OnEvent('password-recovery.requested')
  async handlePasswordRecoveryRequested(event: PasswordRecoveryRequestedEvent): Promise<void> {
    // build → send → catch
  }
}
```

Behavior inside the handler:

1. `const { subject, text } = buildPasswordRecoveryEmail(event.resetUrl);`
2. Wrap the send in `try/catch` — the whole body, so nothing escapes:
   ```ts
   try {
     const result = await this.mailService.send({ to: event.email, subject, text });
     if (result.status === 'sent') {
       this.logger.debug(`recovery email sent (messageId=${result.messageId}) for user ${event.userId}`);
     }
     // status === 'skipped' → do nothing; MailService already logged its own debug line
   } catch (err) {
     const reason = err instanceof Error ? err.message : String(err);
     this.logger.warn(`recovery email not sent for user ${event.userId}: ${reason}`);
   }
   ```
3. Do **not** pass `from` or `html` to `send`. Do **not** rethrow. Return `void`.
4. Never log `event.email`, `event.token`, `event.resetUrl`, the subject, or the body — only
   `event.userId` and, on failure, the error message. (`err.message` may itself contain the
   recipient address for the 550 recipient-rejected case; that is acceptable and matches
   `MailService`'s existing `error`-level contract.)

Import ordering (`import/order`, alphabetized, no blank lines between groups):
`@nestjs/common` → `@nestjs/event-emitter` → `../mail/... ` is wrong — `MailService` is imported
from `../../mail/mail.service.js`; the builder from `./password-recovery-email.content.js`; the
event from `./password-recovery-requested.event.js`. Use NodeNext `.js` extensions.

`sort-class-members`: `logger` and `mailService` properties, then constructor, then the public
`@OnEvent` method.

### Spec — `backend/src/auth/tests/password-recovery-requested.listener.spec.ts`

`new PasswordRecoveryRequestedListener(fakeMailService)` where `fakeMailService = { send: jest.fn() }`.
Spy on `Logger.prototype.debug` and `Logger.prototype.warn` (as `mail.service.spec.ts` does),
`jest.restoreAllMocks()` in `afterEach`. A reusable `event` fixture:
`{ userId: 1, token: 'plain-token-SECRET', resetUrl: 'https://app.example/#/recover-password?token=plain-token-SECRET', email: 'darthjee@example.com' }`.

- **happy path** — `send` resolves `{ status: 'sent', messageId: 'mid-1' }`:
  `send` called exactly once with `{ to: 'darthjee@example.com', subject: 'Reset your Kerghan password', text: expect.stringContaining(event.resetUrl) }`; the call args have **no** `from` and **no** `html` key; one `debug` line logged containing `messageId=mid-1` and `user 1`; the handler resolves.
- **disabled mail** — `send` resolves `{ status: 'skipped' }`: handler resolves, no `warn`, no
  `debug` (or assert `warn` not called — `debug` on skip is explicitly not wanted).
- **transport failure** — `send` rejects `new Error('transport exploded')`: handler resolves
  (`await expect(...).resolves.toBeUndefined()`), one `warn` with `user 1` and
  `transport exploded`; assert the `warn` call args contain **neither** `plain-token-SECRET` nor
  the body text (`can only be used once`).
- **recipient rejected** — `send` rejects `new Error('mail: recipient rejected: darthjee@example.com')`:
  handler still resolves; `warn` logged.

## Files to Change

- `backend/src/auth/events/password-recovery-requested.listener.ts` — **new**; the `@Injectable()`
  `@OnEvent` listener.
- `backend/src/auth/tests/password-recovery-requested.listener.spec.ts` — **new**; unit tests.
