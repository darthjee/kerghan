# Backend Plan: Migrate existing ad-hoc logging onto the Core logger service

Main plan: [plan.md](plan.md)

## Context

#49 sub-issue 1 landed in `af8bed0` as the Core logger service:

- `backend/src/core/logger.service.ts` — `@Injectable() LoggerService` with
  `debug/info/warn/error(message: string, attributes?: Record<string, unknown>): void`. Level
  threshold read once from `KERGHAN_LOG_LEVEL` (default `info`); a call is dropped when its level
  rank is below the threshold. Backed by `console[level](message)` /
  `console[level](message, attributes)`. When a request context is active it merges
  `{ requestId, ...attributes }` automatically — callers never pass `requestId`.
- `backend/src/core/logging.module.ts` — `@Global()` `LoggingModule`, already imported by
  `AppModule`, so `LoggerService` is constructor-injectable anywhere with no `imports` change.

Today's ad-hoc call sites:

| File | Today | Level(s) |
|---|---|---|
| `backend/src/mail/mail.module.ts` | `new Logger('MailModule')` in `createMailTransport` (the `MAIL_TRANSPORT` `useFactory`), `logger.log(...)` | info (Nest `log`) |
| `backend/src/mail/mail.service.ts` | `private readonly logger = new Logger(MailService.name)` | `debug` (disabled/skip), `error` (send failed) |
| `backend/src/auth/events/password-recovery-requested.listener.ts` | `private readonly logger = new Logger(PasswordRecoveryRequestedListener.name)` | `debug` (sent), `warn` (not sent) |
| `backend/src/main.ts` | `console.warn` (listening), `console.error` (in `bootstrap().catch`) | — |
| `backend/src/database/migrations/20260824120004-auth-seed-demo-user.ts` | `console.warn` (STAGE=production skip) | — |
| `backend/src/database/migrations/20260903120007-auth-promote-demo-user-admin.ts` | `console.warn` (STAGE=production skip) | — |

### Conventions decided for this migration

- **Message shape**: short static `message` string; every value currently interpolated into the
  string moves into the `attributes` object. No new fields beyond what the old string carried.
- **Context tag**: the `[ClassName]` prefix Nest's `Logger` printed is preserved as
  `{ context: '<ClassName>' }` on each migrated call (`'MailModule'`, `'MailService'`,
  `'PasswordRecoveryRequestedListener'`).
- **Levels/conditions**: unchanged. `mail.module.ts`'s `logger.log(...)` maps to
  `loggerService.info(...)`.
- **`main.ts` catch block**: stays `console.error(err)` — that handler runs when
  `NestFactory.create` may have thrown and no DI container exists. Add a one-line comment.
- **Migrations**: keep `console.warn` (run via the TypeORM CLI, outside the Nest DI lifecycle).
  Extend the existing `// eslint-disable-next-line no-console` comment with a one-line note on why
  they don't use `LoggerService`.
- **PII discipline**: unchanged — the listener still logs only `userId` (+ `messageId`/`reason`),
  never address/token/reset link/subject/body; `mail.service.ts` still never logs message bodies;
  `mail.module.ts` still never logs the SMTP password / full config.
- **Spec pattern**: follow `backend/src/core/tests/logger.service.spec.ts` — build a plain
  `{ debug: jest.fn(), info: jest.fn(), warn: jest.fn(), error: jest.fn() }` double and pass it
  where the class is `new`-ed directly, or register it as a `LoggerService` provider in a
  `Test.createTestingModule` when DI is used.

## Steps

- [01 — Migrate `mail.module.ts` transport factory](backend/01-migrate-mail-module.md)
- [02 — Migrate `mail.service.ts`](backend/02-migrate-mail-service.md)
- [03 — Migrate `password-recovery-requested.listener.ts`](backend/03-migrate-recovery-listener.md)
- [04 — Migrate `main.ts` and annotate the two migrations](backend/04-migrate-main-and-annotate-migrations.md)
- [05 — Port the unit specs](backend/05-port-unit-specs.md)

## CI Checks

- `backend`: `npm run coverage` (CI job: `backend_tests`) — Jest with coverage; migrated specs must pass.
- `backend`: `npm run lint` (CI job: `backend_checks`) — `eslint src`; `no-console` stays disabled
  only where a comment justifies it (`main.ts` catch, the two migrations).

## Notes

- `MailService` and `PasswordRecoveryRequestedListener` currently gain their `Logger` via
  `new Logger(...)` as a field initializer, and their unit specs construct them with `new` (not a
  Nest testing module). Adding a `LoggerService` constructor parameter forces every `new` call in
  those specs to pass the double — this is the bulk of Step 05.
- `createMailTransport` is a `useFactory`; it receives `LoggerService` by adding it to the
  `MAIL_TRANSPORT` provider's `inject` array. No `imports` change is needed (`LoggingModule` is
  `@Global`).
- No production `KERGHAN_LOG_LEVEL` change: `mail.module.ts` / `main.ts` boot lines were Nest
  `log`/`console.warn` (always visible); routed through `info` they stay visible at the default
  threshold. The `mail.service.ts` "skip" line stays `debug` (hidden by default) exactly as today.
- E2E specs that boot `AppModule` need no change — `LoggingModule` is already wired in globally.
- Nothing here touches `app.useLogger()`, request-correlation wiring, or adds logging points —
  all explicitly out of scope in the issue.
