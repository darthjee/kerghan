# Backend Plan: Send password-recovery email when a reset token is created

Main plan: [plan.md](plan.md)

## Overview

All work lives under `backend/src/auth/` plus three documentation files. #36 and #38 are both
merged to `main`, so the `PasswordRecoveryRequestedEvent` payload class, `PasswordResetService`,
and the `MailService` all already exist — this issue connects them.

The build order below is dependency-first: the event field lands before the listener that reads
it; the pure content builder lands before the listener that calls it; the module wiring lands
last so the listener is only registered once its collaborators compile.

## Context

- `PasswordResetService#recover` (`backend/src/auth/password-reset.service.ts`) already loads the
  `user` row and emits `password-recovery.requested` via `EventEmitter2.emit` (synchronous,
  fire-and-forget) with a `PasswordRecoveryRequestedEvent(userId, token, resetUrl)` — no email
  address, and no listener consumes it yet.
- `MailService` (`backend/src/mail/mail.service.ts`, exported by `MailModule`) exposes
  `send({ to, subject, text, html?, from? }): Promise<{ status: 'sent' | 'skipped'; messageId? }>`.
  It resolves `{ status: 'skipped' }` when `KERGHAN_EMAILS_ENABLED !== 'true'` (never throwing),
  and rejects when a configured send fails. `from` defaults to `KERGHAN_EMAIL_FROM`.
- `EventEmitterModule.forRoot()` is registered globally in `AppModule`; `@nestjs/event-emitter`
  `^2.1.1` provides `@OnEvent`.
- Module structure convention (`docs/agents/architecture/modular-pattern.md`): `events/` holds
  both `@OnEvent` handlers and event payload classes; specs live under `<module>/tests/`.
- Test style (`backend/src/auth/tests/password-reset.service.spec.ts`,
  `backend/src/mail/tests/mail.service.spec.ts`): plain unit tests that `new` the class with
  fakes — no `Test.createTestingModule` for services/listeners. Jest + `@swc/jest`,
  `moduleNameMapper` strips the `.js` from NodeNext-style imports.
- ESLint (`backend/eslint.config.mjs`): `import/order` alphabetized with no blank lines between
  groups; `sort-class-members` (properties → constructor → public methods → private methods);
  `jsdoc/check-param-names` is an error (every method carries `@param`/`@returns`); `max-lines`
  300, `complexity` 10.

## Steps

- [01 — Add `email` to the recovery-requested event](backend/01-add-email-to-event.md)
- [02 — Recovery-email content builder](backend/02-recovery-email-content-builder.md)
- [03 — `password-recovery.requested` listener](backend/03-recovery-requested-listener.md)
- [04 — Wire `MailModule` into `AuthModule`](backend/04-wire-mailmodule-into-authmodule.md)
- [05 — Documentation updates](backend/05-documentation-updates.md)

## CI Checks

- `backend/`: `docker-compose run --rm kerghan_tests yarn test` (CI job: `backend_tests`, which
  runs `npm run coverage` — new `.ts` under `src/` that is not a `*.module.ts` is
  coverage-collected and reported to Codacy, so the builder and listener need full unit
  coverage).
- `backend/`: `docker-compose run --rm kerghan_tests yarn lint` (CI job: `backend_checks`).

## Notes

- **Single-owner plan.** Only `backend` has implementation work. The three doc edits in step 05
  (`docs/agents/modules/auth.md`, `docs/agents/modules/mail.md`, `docs/agents/summary.md`) are
  documentation scope that would normally sit with `architect`, but `architect` is the excluded
  coordinator — they are folded into this `backend` plan for execution convenience. No
  `architect.md` split file.
- **e2e boot safety.** `backend/src/auth/tests/auth.controller.e2e-spec.ts` imports `AuthModule`
  into a `Test.createTestingModule`. Once `AuthModule` imports `MailModule`, that spec pulls in
  `MailModule` transitively. It boots fine: the test env does not set `KERGHAN_EMAILS_ENABLED`,
  so `buildMailConfig` returns the disabled config and `createMailTransport` returns `null`
  without throwing. The `ConfigModule.forRoot({ isGlobal: true })` already in that spec's imports
  satisfies `MailModule`'s `ConfigService` injection. Do **not** set `KERGHAN_EMAILS_ENABLED=true`
  in any test env.
- **Coexisting listeners.** The `reset-password flow` block in `auth.controller.e2e-spec.ts`
  subscribes to `password-recovery.requested` with `eventEmitter.once(...)` to capture the
  plaintext token. `EventEmitter2` supports multiple listeners, so the new `@OnEvent` handler
  coexists with it; under disabled mail the handler is a no-op (`send()` → `skipped`). No change
  needed to that spec.
- **Filename suffix.** `password-recovery-email.content.ts` introduces a `.content.ts` suffix not
  yet used in this codebase — consistent with `mail.config.ts`'s "pure helper in a suffixed
  file" precedent, and called out in the issue.
- No migration, no API/route/DTO/entity change; `navi/` cache-warmer configs and the proxy are
  untouched; no `X-Skip-Cache` concern.
- No new dependency — `@nestjs/event-emitter` and `nodemailer` are both already in
  `backend/package.json`.
