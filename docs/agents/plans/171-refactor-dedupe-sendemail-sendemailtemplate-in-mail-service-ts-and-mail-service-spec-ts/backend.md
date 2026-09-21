# Backend Plan: Refactor: dedupe sendEmail/sendEmailTemplate in mail.service.ts and mail.service.spec.ts

Main plan: [plan.md](plan.md)

## Overview
`MailService.sendEmail` and `sendEmailTemplate` open with the same prologue (resolve `params.method ?? this.config.method`, `#assertKnownMethod`, disabled short-circuit via `#skip`), and `mail.service.spec.ts` repeats the same cases once per entry point. Extract the prologue into one private helper and parameterise the shared spec cases. Behavior, public API and coverage must not change.

## Context
- The only difference between the two prologues is the `#skip` log attributes: `{ to, subject }` (`sendEmail`) vs `{ to, template }` (`sendEmailTemplate`).
- Decisions agreed in the issue discussion:
  - The helper owns the *whole* prologue, including the `#skip` call, so any future guard (rate limiting, allow-listing) is added in one place.
  - The spec table stays inside `mail.service.spec.ts` — no extracted shared spec helper.
- Project limits (ESLint-enforced): max 300 lines per file, max complexity 10.

## Implementation Steps

### Step 1 — Extract `#resolveSendPlan` in `mail.service.ts`
Add a private helper `#resolveSendPlan(method: string | undefined, logAttrs: Record<string, string>)` (taking `params.method` and the per-caller skip log attrs; or `params` + `logAttrs` if that reads better) that:
1. resolves `method = params.method ?? this.config.method`;
2. calls `this.#assertKnownMethod(method)` (still throws for unknown methods even when disabled, and before any rendering in `sendEmailTemplate`);
3. when `!this.config.enabled`, returns `{ skipped: this.#skip(method, logAttrs) }`;
4. otherwise returns `{ method }`.

Return type is a discriminated union: `{ method: string } | { skipped: SendEmailResult }` (declare a small local type alias). Update both callers:

```ts
const plan = this.#resolveSendPlan(params, { to: params.to, subject: params.subject });
if ('skipped' in plan) return plan.skipped;
return this.#send(params, plan.method);
```

and the equivalent in `sendEmailTemplate` (with `{ to: params.to, template: params.template }`), keeping the rendering step after the plan check so a disabled send still skips before rendering. Keep the existing JSDoc on the public methods accurate; add a short JSDoc to the helper in the style of the surrounding private methods (they currently have none — match the file's density, a one-line comment at most).

### Step 2 — Parameterise the shared cases in `mail.service.spec.ts`
Introduce a `describe.each` table with two rows, `sendEmail` and `sendEmailTemplate`. Each row supplies:
- `call(service, overrides)` — invokes the entry point with valid params merged with `overrides` (`method`, `from`, …);
- the expected log attributes: the subject seen by the "email enabled; sending" debug line (`'Subject line'` vs rendered `'Hi Sam'`) and the disabled-skip log attribute (`subject: 'Subject line'` vs `template: 'welcome'`).

Move these shared cases into the table (each written once):
- uses the per-call method when params provide one;
- uses an explicit `from` address when params provide one;
- disabled: skips the send, logs the debug line carrying the method, never touches a method;
- unknown method rejects — both when enabled (before any delivery) and when disabled;
- the "email enabled; sending" debug line, with the row's subject;
- does not leak bodies on delivery failure, and stringifies a non-Error rejection for the failure log.

Leave in place (entry-point specific): `sendEmail`-only cases (calls the resolved method with the message fields, falls back to configured `from`, delivery rejects, recipient rejected, blank `to`, newline in header) and `sendEmailTemplate`-only cases (renders and delegates, unknown template, missing variable, header injection on the rendered subject, skip-before-render without rejecting on a would-be missing variable). Before deleting any existing case, confirm an equivalent assertion survives in the table — coverage of behavior must not shrink (check with `coverage` output for `mail.service.ts`).

## Files to Change
- `backend/src/mail/mail.service.ts` — add `#resolveSendPlan`, use it from `sendEmail` and `sendEmailTemplate`.
- `backend/src/mail/tests/mail.service.spec.ts` — replace the duplicated per-entry-point cases with a `describe.each` table; keep entry-point-specific cases.

## CI Checks
- `backend`: `docker-compose run --rm kerghan_tests yarn test` (CI job: `backend_tests`, runs `npm run coverage`)
- `backend`: `docker-compose run --rm kerghan_tests yarn lint` (CI job: `backend_checks`)

## Notes
- Run all commands through `docker-compose` (never `yarn`/`npm` directly on the host), per the project boundaries.
- Optionally re-run `jscpd` (if available in the tooling) to confirm the clones at `mail.service.ts` 99-105 ↔ 129-135 and the three spec clones are gone.
- No other module calls `#skip`/`#assertKnownMethod` (both are private), so the change is fully local to `MailService`.
