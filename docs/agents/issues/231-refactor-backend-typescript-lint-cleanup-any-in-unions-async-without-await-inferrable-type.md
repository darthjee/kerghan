# Issue: Refactor: Backend TypeScript lint cleanup (any in unions, async without await, inferrable type)

## Description
Seven small typescript-eslint findings (reported by Codacy on `main`) across four unrelated backend files. Pure typing/lint cleanup — no runtime behaviour change.

Source: Codacy static analysis of `main` (grade B, 538 open issues at the time of filing).

## Problem
- `backend/src/mail/mail.module.ts:27,51,74,80` — `no-redundant-type-constituents` (Warning): `Transporter | null`, where `Transporter`'s generic defaults to `any`, so the union collapses.
- `backend/src/mail/mail.method.ts:38` — `no-unused-vars` (Warning): `_message` in the `EmailMethod#deliver(_message: EmailMethodMessage)` interface signature.
- `backend/src/auth/dummy-digest.ts:18` — `require-await` (Warning): `async compareOrDummy` only returns `bcrypt.compare(...)` without awaiting it.
- `backend/src/database/migrations/helpers.ts:45` — `no-inferrable-types` (Info): `createdAtColumn(name: string = 'created_at')`.

## Expected Behavior
- No runtime behaviour change.
- The mail transport's type becomes precise (no longer collapses to `any`).
- All seven findings listed under **Problem** go away.

## Solution
- **Mail transporter type** — give `Transporter` an explicit type argument matching what `nodemailer.createTransport(config.transport)` returns (for example `Transporter<SMTPTransport.SentMessageInfo>`), ideally through one local type alias used in all four places in `mail.module.ts`. The non-nullable `Transporter` uses in `mail.method.ts` (`NativeEmailMethod`'s field and constructor) use the same alias, so the module and the method it builds agree on one type. Update the matching JSDoc `@param`/`@returns` types.
- **`compareOrDummy`** — drop `async` and return `bcrypt.compare(...)` directly; the signature stays `Promise<boolean>`, so both callers (`AuthService#validateCredentials` and `AuthorizationRequestService#approverPasswordValid`) and `auth/tests/dummy-digest.spec.ts` still work unchanged.
- **`createdAtColumn`** — use `name = 'created_at'` (the JSDoc already documents the type).
- **`mail.method.ts:38`** — try declaring `deliver` as a function-typed property. If the rule still flags interface parameter names (a known false positive), leave it and note that in the PR rather than adding a lint exclusion for one line.
- **Out of scope:** `mail.service.ts` and the mail provider injection token type (`mail.tokens.ts`) stay untouched; other issues own them.

## Verification
- `docker-compose run --rm kerghan_tests yarn lint` and `docker-compose run --rm kerghan_tests yarn coverage` pass, and coverage does not drop.
- After merge, Codacy's re-analysis of `main` no longer reports the findings listed under **Problem**.

## Benefits
Removes seven Codacy findings and tightens the mail module's types.
