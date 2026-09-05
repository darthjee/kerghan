# Issue: Migrate existing ad-hoc logging onto the Core logger service

## Description

Split from #49 (see that issue for the full design rationale). Depends on #49 sub-issue 1 (the
Core logger service), which landed in `af8bed0` as `backend/src/core/logger.service.ts` /
`LoggingModule` — a `@Global()`, constructor-injectable `LoggerService` with
`debug/info/warn/error(message, attributes?)`, level filtering from `KERGHAN_LOG_LEVEL`, a
console transport, and automatic `requestId` merging when a request context is active.

This sub-issue is a mechanical migration of every existing ad-hoc logging call site onto that
service, so Kerghan ends up with one logging mechanism instead of two parallel ones. It also
happens to cover #49's logging point #2, "email sending," since that's exactly the existing
behavior being migrated in `mail.service.ts`.

## Problem

Three classes each instantiate their own NestJS `Logger`, and one file plus two migrations fall
back to raw `console.warn`/`console.error`, with no shared level configuration or shared
formatting:

- `backend/src/mail/mail.module.ts` — `new Logger('MailModule')` inside the `MAIL_TRANSPORT`
  `useFactory` (`createMailTransport`), logging the outbound-mail enabled/disabled state once at
  boot via `logger.log(...)` (Nest `log` == info level).
- `backend/src/mail/mail.service.ts` — `new Logger(MailService.name)`, with existing `debug` (send
  skipped, mail disabled) and `error` (send failed) calls.
- `backend/src/auth/events/password-recovery-requested.listener.ts` —
  `new Logger(PasswordRecoveryRequestedListener.name)`, with existing `debug`/`warn` calls around
  recovery-email delivery outcome.
- `backend/src/main.ts` — raw `console.warn` (boot "listening on port" message) and `console.error`
  (startup-failure handler in `bootstrap().catch(...)`).
- Two migrations (`20260824120004-auth-seed-demo-user.ts`,
  `20260903120007-auth-promote-demo-user-admin.ts`) — raw `console.warn`.

## Expected Behavior

- `mail.module.ts`, `mail.service.ts`, and `password-recovery-requested.listener.ts` no longer
  instantiate their own `new Logger(...)` — they use the Core `LoggerService` instead, at the same
  log levels and for the same conditions as today (boot-time enabled/disabled state, send
  skipped/failed, recovery-email delivery outcome).
- The interpolated values currently embedded in each message string move into the structured
  `attributes` argument, leaving a short static message. For example
  `` `recovery email sent (messageId=${result.messageId}) for user ${event.userId}` `` becomes
  `logger.debug('recovery email sent', { messageId: result.messageId, userId: event.userId })`.
  Same information, no new logging points, no new fields beyond what the old string already carried.
- The class-name context that Nest's `Logger` printed as a `[ClassName]` prefix is preserved as a
  `context` attribute on the migrated calls (`{ context: 'MailService' }`,
  `{ context: 'MailModule' }`, `{ context: 'PasswordRecoveryRequestedListener' }`), so the
  originating class stays visible in the structured output.
- `main.ts`'s boot "listening on port" `console.warn` migrates onto `LoggerService`, obtained via
  `app.get(LoggerService)` after `NestFactory.create` succeeds. The `console.error` inside
  `bootstrap().catch(...)` stays a raw `console.error`, because that handler runs precisely when
  `NestFactory.create` may have thrown and the DI container (and `LoggerService`) may not exist — a
  one-line comment notes why.
- The two migration files keep their raw `console.warn` calls (they run via the TypeORM CLI,
  outside the Nest DI lifecycle, so pulling in a DI service isn't feasible) — a one-line comment in
  each notes why.

## Solution

### Scope

This sub-issue covers only migrating the call sites listed above onto the Core `LoggerService`,
preserving existing behavior/log levels — no new logging points, no new log content beyond
reshaping existing interpolated strings into `message` + `attributes`.

Explicitly **out of scope**:

- The email-enabled-flag-check-per-send-attempt logging point (new behavior, not a migration of
  existing behavior) — separate sub-issue.
- Password-recovery request/found-not-found logging points — separate sub-issue.
- The request-correlation / `LogContext` mechanism — already landed separately; this migration does
  not need to attach `requestId` itself (the service merges it automatically when a request
  context is active, and these particular call sites — boot-time, migrations — largely run outside
  any request context anyway).
- Handing `LoggerService` to `app.useLogger()` to redirect Nest's own framework logging — a
  possible future change, not part of this call-site migration.

### What needs to be done

- `mail.module.ts`: add `LoggerService` to the `MAIL_TRANSPORT` provider's `inject` array and pass
  it into `createMailTransport`; replace `new Logger('MailModule')` + `logger.log(...)` with
  `loggerService.info('outbound email disabled', { context: 'MailModule' })` /
  `loggerService.info('outbound email enabled', { context: 'MailModule', host: config.transport.host })`.
  Keep not logging the SMTP password / full config.
- `mail.service.ts`: drop `private readonly logger = new Logger(MailService.name)`, inject
  `LoggerService` in the constructor, and replace the `debug` (mail disabled; skipping) and
  `error` (mail send failed) calls with `LoggerService` calls carrying `{ context: 'MailService', to, subject }`
  (and `reason` on the error path) as attributes.
- `password-recovery-requested.listener.ts`: drop the `new Logger(...)`, inject `LoggerService`,
  replace the `debug` ("recovery email sent") and `warn` ("recovery email not sent") calls with
  `LoggerService` calls carrying `{ context: 'PasswordRecoveryRequestedListener', userId }`
  (plus `messageId` on the debug path, `reason` on the warn path). Keep the existing discipline of
  never logging the email address, token, reset link, subject, or body.
- `main.ts`: after `NestFactory.create`, `const logger = app.get(LoggerService)` and use
  `logger.info('backend listening', { port })` in place of the `console.warn`. Leave the
  `console.error(err)` in `bootstrap().catch(...)` as-is, with a one-line comment explaining the DI
  container may not exist at that point.
- Migration files: leave the `console.warn` calls untouched, add a one-line comment in each noting
  they run outside Nest DI.
- Update the existing unit specs that currently assert against `Logger.prototype` spies
  (`backend/src/mail/tests/mail.service.spec.ts`,
  `backend/src/auth/tests/password-recovery-requested.listener.spec.ts`) so they assert against the
  injected `LoggerService` (provide a mock/spy `LoggerService` in the testing module and assert on
  its `debug`/`error`/`warn` with the expected message + attributes). Follow the pattern in
  `backend/src/core/tests/logger.service.spec.ts`.

### Acceptance criteria

- [ ] `mail.module.ts` no longer instantiates `new Logger(...)`; its boot-time enabled/disabled log
      goes through `LoggerService` at info level with `{ context: 'MailModule' }` (+ `host` when
      enabled).
- [ ] `mail.service.ts` no longer instantiates `new Logger(...)`; its existing `debug`/`error`
      calls (send skipped, send failed) go through `LoggerService` at the same levels, with the
      previously-interpolated values (`to`, `subject`, `reason`) moved into attributes and
      `{ context: 'MailService' }` set.
- [ ] `password-recovery-requested.listener.ts` no longer instantiates `new Logger(...)`; its
      existing `debug`/`warn` calls go through `LoggerService` at the same levels, with `userId`
      (+ `messageId`/`reason`) in attributes and `{ context: 'PasswordRecoveryRequestedListener' }`
      set, still logging no PII.
- [ ] `main.ts`'s boot `console.warn` goes through `LoggerService`; the `bootstrap().catch(...)`
      `console.error` is deliberately left as raw `console.error` with an explanatory comment.
- [ ] The two migration files are unchanged except for a one-line explanatory comment on their
      `console.warn` calls.
- [ ] Specs for the migrated classes pass, updated to assert against `LoggerService` instead of
      `Logger.prototype`.
- [ ] No behavior change beyond the underlying logging mechanism and the message/attribute split:
      same conditions for logging, same levels, same information content.

## Benefits

- Removes the last of the pre-#49 scattered logging mechanisms outside the 5 new logging points,
  so there's exactly one logging mechanism in the codebase going forward.
- The migrated call sites gain structured attributes and automatic `requestId` correlation for
  free, without adding any new log content.
