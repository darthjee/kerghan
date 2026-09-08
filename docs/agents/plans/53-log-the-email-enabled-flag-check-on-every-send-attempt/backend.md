# Backend Plan: Log the email-enabled flag check on every send attempt

Main plan: [plan.md](plan.md)

## Overview

Add a `debug`-level log line to `MailService`'s private `#send()` method
(`backend/src/mail/mail.service.ts`), confirming that the enabled-flag check passed and the send
is proceeding — the missing counterpart to `#skip()`'s existing disabled-path log. Cover it with a
unit spec.

## Context

`sendEmail` and `sendEmailTemplate` both check `this.config.enabled` and, when `false`, call
`#skip()`, which already logs `'email disabled; skipping send'` at `debug` with
`{ context: 'MailService', to, subject, method }` (tested in `mail.service.spec.ts`, `'when email
is disabled'`). When `true`, both methods call the private `#send()` method — the single shared
point reached only once the enabled-check has passed. `#send()` currently only logs on the error
path (`logger.error('mail send failed', ...)` in its `catch`); there is no log confirming the
enabled/proceeding outcome itself.

## Implementation Steps

### Step 1 — Add the enabled-path debug log to `#send()`

At the top of `#send()`, before `this.#assertSendable(params, from)`, add:

```ts
this.logger.debug('email enabled; sending', {
  context: 'MailService',
  to: params.to,
  subject: params.subject,
  method,
});
```

This mirrors `#skip()`'s message/attribute shape exactly (message text swapped for the enabled
case), and fires for both `sendEmail` and `sendEmailTemplate` since both funnel into `#send()`.
Placing it before `#assertSendable` means it logs the moment the flag-check outcome is known,
independent of whether the send itself later succeeds, fails validation, or throws.

### Step 2 — Unit spec

In `backend/src/mail/tests/mail.service.spec.ts`, add a case (near the existing `'when enabled and
the delivery succeeds'` block) asserting:

- `logger.debug` is called with `'email enabled; sending'` and
  `{ context: 'MailService', to, subject, method }` for an enabled `sendEmail` call.
- The same fires for an enabled `sendEmailTemplate` call (subject is the *rendered* subject, since
  `#send()` is reached only after template rendering).
- The log is emitted via `logger.debug` specifically — not `logger.info` or above — confirming it
  stays silent at Kerghan's default `KERGHAN_LOG_LEVEL=info` (the existing spec setup mocks
  `logger.debug`/`info`/`warn`/`error` as separate jest mocks, so asserting the call landed on
  `logger.debug` and not the others is sufficient; no need to re-test `LoggerService`'s own
  level-filtering, which already has its own coverage).

## Files to Change

- `backend/src/mail/mail.service.ts` — add the debug log call in `#send()`.
- `backend/src/mail/tests/mail.service.spec.ts` — add the unit spec for both call paths.

## CI Checks

- `backend`: `npm run coverage` (CI job: `backend_tests`)
- `backend`: `npm run lint` (CI job: `backend_checks`)

## Notes

- Do not touch `#skip()`, the boot-time log in `mail.module.ts`, or `#send()`'s existing
  error-path log — all already implemented and out of scope for this issue.
- No new dependencies or config; `LoggerService` is already injected into `MailService`.
