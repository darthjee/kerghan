# Issue: Refactor: dedupe sendEmail/sendEmailTemplate in mail.service.ts and mail.service.spec.ts

## Description
`MailService.sendEmail` and `sendEmailTemplate` share the same prologue, and `mail.service.spec.ts` repeats the same test cases for each.

## Problem
- `backend/src/mail/mail.service.ts`: lines 99-105 ↔ 129-135 (jscpd, 7 lines) — both methods resolve `params.method ?? this.config.method`, call `#assertKnownMethod(method)`, and short-circuit to `#skip(...)` when `!this.config.enabled`. The only difference is the `#skip` log attributes (`{ to, subject }` vs `{ to, template }`).
- `backend/src/mail/tests/mail.service.spec.ts`: three clones (29 lines) between the `sendEmail` and `sendEmailTemplate` blocks — e.g. 97-107 ↔ 255-265 (`uses the per-call method when params provide one`), 137-146 ↔ 357-366, 107-114 ↔ 265-272. Beyond the flagged clones, several other cases are the same apart from the entry point and a few field names.

## Expected Behavior
The method-resolution/enabled-check prologue lives in one private helper, and the spec runs the shared cases once for both entry points via `describe.each`. Behavior and coverage unchanged.

## Solution
### Service
Extract a private helper `#resolveSendPlan(params, logAttrs)` that owns the whole prologue: it resolves `params.method ?? this.config.method`, calls `#assertKnownMethod`, and — when email is disabled — calls `#skip`. It returns a discriminated union (`{ method } | { skipped: SendEmailResult }`); each caller does `if ('skipped' in plan) return plan.skipped;`. `logAttrs` carries the per-caller skip log attributes (`{ to, subject }` / `{ to, template }`).

### Spec
Parameterise the shared cases with a `describe.each` table over `sendEmail` / `sendEmailTemplate`, kept inside `mail.service.spec.ts` (no extracted shared helper). Each row supplies a `call(service, overrides)` function plus the expected log attributes (`subject` vs `template`, rendered subject). Shared cases:
- uses the per-call method;
- uses an explicit `from`;
- disabled skip (with the row's log attrs);
- unknown method, both enabled and disabled;
- the "email enabled; sending" debug line (with the row's subject);
- not leaking bodies on delivery failure, and stringifying a non-Error rejection.

Cases specific to one entry point stay where they are: `sendEmailTemplate`-only (unknown template, missing variable, header injection on the rendered subject, skip-before-render) and `sendEmail`-only (blank `to`, newline in header, recipient rejected).

## Benefits
Any new guard (rate limiting, allow-listing) is added in one place and automatically covers both send paths; the spec no longer needs every case written twice.
