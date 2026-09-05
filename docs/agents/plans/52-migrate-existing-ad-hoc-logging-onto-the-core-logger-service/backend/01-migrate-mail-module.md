# Migrate `mail.module.ts` transport factory

Replace the `new Logger('MailModule')` used inside `createMailTransport` (the `MAIL_TRANSPORT`
`useFactory`) with the injected Core `LoggerService`.

- Add `LoggerService` to the `MAIL_TRANSPORT` provider's `inject` array:
  `inject: [MAIL_CONFIG, LoggerService]`, and give `createMailTransport` a second parameter
  `logger: LoggerService`. Import `LoggerService` from `../core/logger.service.js`. No `imports`
  entry is needed — `LoggingModule` is `@Global` and already loaded by `AppModule`.
- Drop `const logger = new Logger('MailModule')` and the `Logger` import from `@nestjs/common`
  (keep `Module`).
- Replace the two `logger.log(...)` calls with `logger.info(...)`, moving interpolated values into
  attributes and setting the context:
  - disabled branch: `logger.info('outbound email disabled', { context: 'MailModule' })`
  - enabled branch:
    `logger.info('outbound email enabled', { context: 'MailModule', host: config.transport.host })`
- Keep the existing rule of never logging `config` wholesale / the SMTP password — only `host`.
- Update the `createMailTransport` JSDoc to mention the injected logger instead of "logs once".

## Files to Change

- `backend/src/mail/mail.module.ts` — inject `LoggerService` into the `MAIL_TRANSPORT` factory;
  swap `new Logger('MailModule')` + `logger.log(...)` for `logger.info(...)` with `context` /
  `host` attributes; drop the `Logger` import.
