# Plan: Migrate existing ad-hoc logging onto the Core logger service

Issue: [52-migrate-existing-ad-hoc-logging-onto-the-core-logger-service.md](../../issues/52-migrate-existing-ad-hoc-logging-onto-the-core-logger-service.md)

## Overview

Replace every pre-#49 ad-hoc logging call site in `backend/` with the Core `LoggerService`
(`backend/src/core/logger.service.ts`, `@Global` via `LoggingModule`). `MailModule`'s transport
factory, `MailService`, and `PasswordRecoveryRequestedListener` stop instantiating their own
`new Logger(...)` and inject `LoggerService` instead; `main.ts`'s boot `console.warn` moves onto
it too. Interpolated values in each message move into the structured `attributes` argument and the
Nest `[ClassName]` context becomes a `context` attribute. The `bootstrap().catch(...)`
`console.error` and the two TypeORM-CLI migrations keep raw `console.*` (they run without a DI
container), gaining only an explanatory comment. Existing `Logger.prototype`-spy specs are ported
to assert against an injected `LoggerService` double.

All work is in `backend/` — single owner.

See [backend.md](backend.md) for the full plan.
