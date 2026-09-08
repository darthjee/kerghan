# Backend Plan: Log password-recovery requests and found/not-found outcome

Main plan: [plan.md](plan.md)

## Implementation Steps

### Step 1 — Inject `LoggerService` into `PasswordResetService` and log the two events

In `backend/src/auth/password-reset.service.ts`:

- Add a `private readonly logger: LoggerService;` field and a fourth constructor parameter,
  following the exact injection pattern already used by `MailService`
  (`backend/src/mail/mail.service.ts`) and `PasswordRecoveryRequestedListener`
  (`backend/src/auth/events/password-recovery-requested.listener.ts`) — `LoggerService` comes from
  the global `LoggingModule` (`backend/src/core/logging.module.ts`), so no `AuthModule` provider
  changes are needed.
- At the very start of `recover()`, before the `userRepository.findOneBy` lookup, call
  `this.logger.info('password recovery requested', { context: 'PasswordResetService' })`.
- Immediately after the `findOneBy` lookup resolves, log the outcome at `info` level, including the
  submitted email in both cases and `userId` when found:
  - Found: `this.logger.info('password recovery user found', { context: 'PasswordResetService', email: dto.email, userId: user.id })`
  - Not found: `this.logger.info('password recovery user not found', { context: 'PasswordResetService', email: dto.email })`
- No `requestId` handling needed — `LoggerService` already merges the active request's `requestId`
  into every line automatically via `RequestContextService`/`RequestContextMiddleware` (already
  applied globally in `AppModule`).
- Do not change `recover()`'s control flow, return value, or the early `return` on `!user` — only
  add the two log calls around the existing lookup.
- Exact log message strings and attribute key names above are a proposed default — keep them
  consistent with the sibling `info`-level lines already in the codebase (e.g.
  `backend/src/core/request-context.middleware.ts`'s `'request'` line, `backend/src/mail/mail.module.ts`'s
  enabled/disabled lines) if a closer match becomes apparent while implementing.

### Step 2 — Unit specs

In `backend/src/auth/tests/password-reset.service.spec.ts`:

- Extend the `beforeEach` service construction with a mocked `LoggerService`
  (`{ info: jest.fn(), debug: jest.fn(), warn: jest.fn(), error: jest.fn() }`, matching the
  existing `repoMock`/`configService` mock style in this file), passed as the new fourth
  constructor argument.
- Under `describe('recover', ...)`, add assertions that `logger.info` is called with the
  "password recovery requested" line on every call, regardless of outcome.
- Under `describe('when the email matches an account', ...)`, add an assertion that `logger.info`
  is called with the found-outcome line, including `email: 'darthjee@example.com'` and
  `userId: 1`.
- Under `describe('when the email does not match an account', ...)`, add an assertion that
  `logger.info` is called with the not-found-outcome line, including `email: 'nobody@example.com'`.

## Files to Change

- `backend/src/auth/password-reset.service.ts` — inject `LoggerService`; add the two `info`-level
  log calls inside `recover()`.
- `backend/src/auth/tests/password-reset.service.spec.ts` — mock `LoggerService`; assert both log
  lines across the found/not-found cases.

## CI Checks

- `backend`: `yarn test` (CI job: `backend_tests`)
- `backend`: `yarn lint` (CI job: `backend_checks`)

## Notes

- `AuthModule` needs no changes — `LoggingModule` is `@Global()`, so `LoggerService` is already
  injectable anywhere without an explicit import.
- The HTTP response of `/auth/recover.json` must remain byte-for-byte identical for found and
  not-found cases — this issue is logging-only.
- The submitted email is deliberately included in the found/not-found log line per #49's
  already-made anti-enumeration trade-off decision (see the issue file) — do not omit it or gate it
  behind a flag.
