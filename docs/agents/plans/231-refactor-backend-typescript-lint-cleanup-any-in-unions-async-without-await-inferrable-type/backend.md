# Backend Plan: Refactor: Backend TypeScript lint cleanup (any in unions, async without await, inferrable type)

Main plan: [plan.md](plan.md)

## Overview
Fix seven typescript-eslint findings Codacy reports on `main`, without any runtime behaviour change: give the nodemailer transporter a precise type, drop a needless `async`, drop an inferrable type annotation, and try to silence the interface-parameter `no-unused-vars` warning without a lint exclusion.

## Context
- `Transporter` from `nodemailer` defaults its generic to `any`, so `Transporter | null` collapses (`no-redundant-type-constituents`) at `src/mail/mail.module.ts:27,51,74,80`.
- `nodemailer.createTransport(config.transport)` (with the local `TransportOptions` from `mail.config.ts`) resolves to the overload returning `Transporter<SMTPTransport.SentMessageInfo, SMTPTransport.Options>` in `@types/nodemailer` ^8.
- `compareOrDummy` (`src/auth/dummy-digest.ts:18`) is `async` but just returns `bcrypt.compare(...)`. Callers: `AuthService#validateCredentials` (awaits it) and `AuthorizationRequestService#approverPasswordValid` (returns it); spec: `src/auth/tests/dummy-digest.spec.ts`.
- `createdAtColumn(name: string = 'created_at')` at `src/database/migrations/helpers.ts:45`.
- `EmailMethod#deliver(_message: EmailMethodMessage)` at `src/mail/mail.method.ts:38` is flagged by `no-unused-vars` even though `argsIgnorePattern: '^_'` is configured locally (`eslint.config`) — likely Codacy's own rule config.

## Steps

- [01 — Type the mail transporter precisely](backend/01-type-mail-transporter.md)
- [02 — Drop async from compareOrDummy](backend/02-drop-async-compare-or-dummy.md)
- [03 — Drop inferrable type in createdAtColumn](backend/03-drop-inferrable-type-created-at.md)
- [04 — Address the deliver interface parameter warning](backend/04-deliver-interface-parameter.md)

## CI Checks
- `backend`: `docker-compose run --rm kerghan_tests yarn lint` (CI job: `backend_checks`)
- `backend`: `docker-compose run --rm kerghan_tests yarn coverage` (CI job: `backend_tests`) — coverage must not drop.

## Notes
- Out of scope: `src/mail/mail.service.ts` and the provider token type in `src/mail/mail.tokens.ts` (owned by other issues).
- Do not add lint exclusions/disable comments for these findings.
- Final confirmation (Codacy no longer reporting the findings) only happens after merge, on `main`'s re-analysis.
