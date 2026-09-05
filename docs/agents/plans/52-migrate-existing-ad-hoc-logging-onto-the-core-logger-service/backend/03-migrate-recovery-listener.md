# Migrate `password-recovery-requested.listener.ts`

Replace `PasswordRecoveryRequestedListener`'s own `new Logger(PasswordRecoveryRequestedListener.name)`
with a constructor-injected `LoggerService`.

- Remove `private readonly logger = new Logger(PasswordRecoveryRequestedListener.name)` and the
  `Logger` import from `@nestjs/common` (keep `Injectable`).
- Add `private readonly logger: LoggerService` and accept it as a second constructor parameter
  after `mailService` (resolves by type). Import from `../../core/logger.service.js`.
- Migrate the two calls, keeping levels and the "only log userId / reason" discipline:
  - success (currently
    `` this.logger.debug(`recovery email sent (messageId=${result.messageId}) for user ${event.userId}`) ``):
    `this.logger.debug('recovery email sent', { context: 'PasswordRecoveryRequestedListener', userId: event.userId, messageId: result.messageId })`
  - failure (currently
    `` this.logger.warn(`recovery email not sent for user ${event.userId}: ${reason}`) ``):
    `this.logger.warn('recovery email not sent', { context: 'PasswordRecoveryRequestedListener', userId: event.userId, reason })`
- The `skipped` outcome still logs nothing. `reason` keeps its existing derivation. Do not add
  `email`, `token`, `resetUrl`, `subject`, or `text` to the attributes.
- Update the class JSDoc line that says "logged at `warn`" only if wording needs it; the
  "Only `event.userId` (and, on failure, the error message) is ever logged" sentence stays true.

## Files to Change

- `backend/src/auth/events/password-recovery-requested.listener.ts` — drop the `new Logger(...)`
  field and `Logger` import; inject `LoggerService`; rewrite the `debug` (sent) and `warn`
  (not sent) calls as static message + `{ context, userId[, messageId | reason] }` attributes.
