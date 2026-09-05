# Migrate `mail.service.ts`

Replace `MailService`'s own `new Logger(MailService.name)` with a constructor-injected
`LoggerService`.

- Remove `private readonly logger = new Logger(MailService.name)` and the `Logger` import from
  `@nestjs/common` (keep `Inject`, `Injectable`).
- Add `private readonly logger: LoggerService` and accept it as a constructor parameter (after the
  two existing `@Inject(...)` params — `LoggerService` resolves by type, no token needed). Import
  from `../core/logger.service.js`. Assign `this.logger = logger`.
- Migrate the two calls, keeping the same levels and conditions:
  - disabled/skip branch (currently
    `` this.logger.debug(`email disabled; skipping message to ${params.to} subj=${params.subject}`) ``):
    `this.logger.debug('email disabled; skipping send', { context: 'MailService', to: params.to, subject: params.subject })`
  - send-failed branch (currently
    `` this.logger.error(`mail send failed to ${params.to} subj=${params.subject}: ${reason}`) ``):
    `this.logger.error('mail send failed', { context: 'MailService', to: params.to, subject: params.subject, reason })`
- `reason` keeps its existing derivation (`err instanceof Error ? err.message : String(err)`), so
  the raw `Error` object / stack is still never logged and message bodies are still never logged.
- Update the class JSDoc if it references the private `Logger`.

## Files to Change

- `backend/src/mail/mail.service.ts` — drop the `new Logger(...)` field and `Logger` import;
  inject `LoggerService`; rewrite the `debug` (skip) and `error` (send failed) calls as static
  message + `{ context, to, subject[, reason] }` attributes.
