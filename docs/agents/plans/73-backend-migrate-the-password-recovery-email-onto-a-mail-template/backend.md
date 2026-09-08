# Backend Plan: Backend: migrate the password-recovery email onto a mail template

Main plan: [plan.md](plan.md)

## Overview

Add the `password-recovery` template under `backend/src/mail/templates/`, repoint the
in-module listener and `AdminService.sendRecoveryEmail` onto `MailService.sendEmailTemplate`,
delete `password-recovery-email.content.ts` + its spec, update the affected specs, add a
mail-template spec for the shipped template, and update `docs/agents/modules/auth.md` and
`docs/agents/modules/mail.md`.

## Context

- #75 landed `sendEmailTemplate(params)`, `renderTemplate`, `buildTemplateRegistry`, and the
  `nest-cli.json` assets copy for `mail/templates/**/*`. The template system currently has
  **no shipped template** — only a `.gitkeep` and test fixtures.
- Current sender: `buildPasswordRecoveryEmail(resetUrl) → { subject, text }` in
  `backend/src/auth/events/password-recovery-email.content.ts`, spread onto
  `mailService.sendEmail({ to, subject, body: text })` at both call sites.
  - `password-recovery-requested.listener.ts` — best-effort: whole body in `try/catch`,
    `{ status: 'skipped' }` treated as success, `debug` on `sent` / `warn` on failure logging
    `userId` + reason only (never address/token/url/body).
  - `AdminService.sendRecoveryEmail(userId)` — `await`ed synchronously, returns
    `{ sent: result.status === 'sent' }`, `catch → { sent: false }`.
- `SendEmailTemplateParams` = `{ to, template, variables, from?, method? }`. With mail
  **disabled** (the default in every test that boots the app), `sendEmailTemplate` returns
  `{ status: 'skipped', method }` **before rendering** — an unknown template / missing variable
  only throws when mail is enabled.
- `template-registry.ts` reads `subject.txt` with a single trailing newline stripped and
  `body.txt` **verbatim** (no strip). Per the issue, a single trailing newline on `body.txt`
  is acceptable — the rendered `text` may differ from `buildPasswordRecoveryEmail`'s output by
  that one `\n` and nothing else.
- Boot scans `backend/src/mail/templates/` via `buildTemplateRegistry`; a template dir with
  `subject.txt` but no `body.txt` (or vice-versa) **fails boot**. Both files must land in the
  same commit.

## Verbatim source strings (from `password-recovery-email.content.ts`)

`subject.txt` content (registry strips the trailing newline):

```
Reset your Kerghan password
```

`body.txt` content — `BODY_PREFIX` + `\n{{resetUrl}}\n` + `BODY_SUFFIX`, with `{{resetUrl}}`
alone on its own line. Keep the em dash (`—`, U+2014) in "ignore this email —" and the
apostrophes exactly as below. A single trailing newline is fine.

```
Hi,

We received a request to reset the password for your Kerghan account.

Open this link to choose a new password:
{{resetUrl}}

This link can only be used once, and it expires a short time after it was
requested. If it has already expired, request a new one from the sign-in page.

If you didn't ask to reset your password, you can safely ignore this email —
your password won't change.
```

`{{resetUrl}}` is the only variable. No `body.html`.

## Steps

- [01 — Add the `password-recovery` template](backend/01-add-password-recovery-template.md)
- [02 — Repoint the listener and admin service onto `sendEmailTemplate`](backend/02-repoint-callers.md)
- [03 — Update and remove the affected specs](backend/03-update-specs.md)
- [04 — Add a mail-template spec for `password-recovery`](backend/04-add-mail-template-spec.md)
- [05 — Update the Auth and Mail module docs](backend/05-update-docs.md)

## CI Checks

- `backend`: `docker-compose run --rm kerghan_tests yarn coverage` (CI job: `backend_tests`)
- `backend`: `docker-compose run --rm kerghan_tests yarn lint` (CI job: `backend_checks`)

## Notes

- **Byte-for-byte relaxed** per the issue: assert visible content (subject, the `{{resetUrl}}`
  line, the two reassurance sentences), **not** equality with the old helper output and **not**
  the absence of a trailing newline.
- The template dir must contain **both** `subject.txt` and `body.txt` in the same commit or the
  app fails to boot (breaking every e2e spec).
- `password-recovery-requested.event.ts` has a doc-comment reference to
  `password-recovery-email.content.ts` (line ~6) — update it in step 02 so no dangling
  reference remains.
- `admin.controller.e2e-spec.ts` only asserts the `{ sent: expect.any(Boolean) }` response
  body and never inspects the `MailService` call shape; with mail disabled the template is
  never rendered. Confirm no change is needed there rather than assuming one.
- No `MailService` / template-system changes, no HTML body, no copy/subject/`resetUrl`-format
  changes — all out of scope.
