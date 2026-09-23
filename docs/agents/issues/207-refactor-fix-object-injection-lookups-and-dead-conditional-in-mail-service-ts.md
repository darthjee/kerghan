# Issue: Refactor: Fix object-injection lookups and dead conditional in mail.service.ts

## Description
`MailService` looks up delivery methods with `this.methods[method]` and then checks the result for
falsiness, flagged by Codacy static analysis.

## Problem
In `backend/src/mail/mail.service.ts`: `security/detect-object-injection` (High) at `:199` and
`:211`, and `no-unnecessary-condition` (High) at `:211` ("value is always falsy") — the
`Record<string, EmailMethod>` type says the lookup never yields `undefined`, so the guard looks
dead to the compiler even though it is the runtime check for an unknown method name.

## Expected Behavior
`deliver` still throws `mail: unknown method: <name>` for unknown names and delivers through the
chosen method otherwise.

## Solution
Wrap the injected record in a private `Map<string, EmailMethod>` inside `MailService` (built once
in the constructor from `Object.entries`) and use `.get()`; the "unknown method" check then tests
a genuinely possibly-undefined value. Do not change `mail.module.ts` or the provider token type
(owned by the backend TS-lint-cleanup issue). Keep the existing `MailServiceSpec` cases — the
"unknown method" case already exists (`backend/src/mail/tests/mail.service.spec.ts:158` and
`:168`), so no new test is required unless the refactor changes its shape.

### Verification

- `docker-compose run --rm kerghan_tests yarn lint` and `docker-compose run --rm kerghan_tests yarn
  coverage` pass, with coverage not reduced.
- After merge, Codacy's re-analysis of `main` no longer reports the findings listed under
  **Problem**.

## Benefits
Removes three High findings and makes the compiler agree with the runtime check.
