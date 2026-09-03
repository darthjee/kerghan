# Backend Plan: Configure outbound email sending infrastructure

Issue: [38-configure-outbound-email-sending-infrastructure.md](../issues/38-configure-outbound-email-sending-infrastructure.md)
Main plan: [plan.md](plan.md)

## Overview

Add `nodemailer` and a trimmed always-on feature module `backend/src/mail/` (`mail.config.ts`
pure helpers, `mail.service.ts`, `mail.module.ts`), wire it into `AppModule`, cover it with unit
tests in the codebase's `new`-the-class style, rename the reserved Django-style email env vars
into the `KERGHAN_EMAIL_*` namespace, and update the backend-domain docs. No controller, DTO,
entity, migration, or route — nothing consumes `MailService` in this issue.

## Context

- No outbound email infrastructure exists today. `.env.dev.sample` and
  `docs/agents/environment-variables.md` ship **reserved, unread** Django-style placeholders
  (`EMAILS_ENABLED`, `EMAIL_HOST`, `EMAIL_PORT`, `EMAIL_HOST_USER`, `EMAIL_HOST_PASSWORD`,
  `EMAIL_USE_TLS`, `DEFAULT_FROM_EMAIL`) with no consuming code.
- The codebase's boot-time config pattern is a `useFactory` provider reading `ConfigService`
  once (see `backend/src/app.module.ts`'s TypeORM/JWT factories and the standalone, unit-tested
  `buildJwtSignOptions`). `docs/agents/product.md`: "no hidden env reads inside classes".
- Module conventions: `docs/agents/architecture/modular-pattern.md` (Core / Always-on / Lazy;
  standard module shape; a module exports its service, consumers import the module and inject
  it). Auth is the existing always-on example (`backend/src/auth/auth.module.ts`).
- Service style: private `readonly` fields declared and assigned in the constructor body (not
  parameter-property shorthand) — see `backend/src/auth/password-reset.service.ts`. Nest's
  built-in `Logger`, scoped by class name.
- Test style: plain unit tests that `new` the class with fake collaborators, no
  `Test.createTestingModule` for services — see `backend/src/core/tests/cache-token.service.spec.ts`.
  `@swc/jest`, specs under `<module>/tests/`. `jest.config.ts` excludes `app.module.ts` and
  bootstrap/wiring from coverage via `collectCoverageFrom`.
- ESLint-enforced: max 300 lines per file, max complexity 10. NodeNext imports carry explicit
  `.js` extensions (e.g. `./mail.service.js`).
- `docker-compose.yml` loads `env_file: .env` (no per-var enumeration) — no compose change
  needed for new env vars. `#39` (send the recovery email) is the first consumer, event-driven.

## Steps

- [01 — Add the nodemailer dependency](backend/01-add-nodemailer-dependency.md)
- [02 — Rename the email env vars to KERGHAN_EMAIL_*](backend/02-rename-email-env-vars.md)
- [03 — mail.config.ts: boot-time config + transport-options helpers](backend/03-mail-config-helpers.md)
- [04 — mail.service.ts: the send() API](backend/04-mail-service.md)
- [05 — mail.module.ts + AppModule wiring](backend/05-mail-module-and-app-wiring.md)
- [06 — Unit tests](backend/06-unit-tests.md)
- [07 — Documentation updates](backend/07-documentation.md)

## CI Checks

- `backend/`: `docker-compose run --rm kerghan_tests yarn coverage` (CI job: `backend_tests`)
  and `docker-compose run --rm kerghan_tests yarn lint` (CI job: `backend_checks`). Never invoke
  `yarn`/`npm` on the host — run through the container (`AGENTS.md`).

## Notes

- `nodemailer` must be added to `package.json` and `yarn.lock` regenerated **inside the
  container** (`docker-compose run --rm kerghan_tests yarn install`), not on the host.
- Keep every new file under 300 lines / complexity 10. If `mail.service.ts` approaches the
  limit, split validation/guards into a small private helper module the same way
  `password-reset.service.ts` was split out of `auth.service.ts` — but it should comfortably fit.
- `MailService` must **not** import `nodemailer` — it receives the transporter (a
  `nodemailer.Transporter`) and the frozen `MailConfig` by injection, so its spec needs no
  module mock. Only `mail.module.ts` calls `nodemailer.createTransport`.
- Do not add a `mail.*.e2e-spec.ts` and do not call `transporter.verify()` at boot.
- Never log the resolved config / transport-options object (it holds `auth.pass`); never log
  message `text` / `html`.
- Confirm the backend test env does not set `KERGHAN_EMAILS_ENABLED=true`, so
  `auth.controller.e2e-spec.ts` (imports `AppModule`, now importing `MailModule`) stays on the
  disabled path and needs no SMTP.
- `.env.dev.sample` and the `docs/agents/**` files are outside `backend/` but are backend-domain
  config/documentation and are owned here for this issue.
