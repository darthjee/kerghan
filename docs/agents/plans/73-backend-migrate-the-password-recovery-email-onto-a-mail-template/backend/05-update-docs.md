# Update the Auth and Mail module docs

Reflect that the recovery email now goes through the `password-recovery` template and
`MailService.sendEmailTemplate`, and register the template as the Mail module's first shipped
one.

## `docs/agents/modules/auth.md`

- Admin-routes paragraph (line ~48): `send-recovery-email.json additionally calls
  MailService.send(...) directly and synchronously` → `calls MailService.sendEmailTemplate(...)
  directly and synchronously` (also fixes the already-stale `.send(` name). Keep the rest of
  the sentence (real `sent: true/false`, `false` covers disabled mail + thrown error, never a
  `500`).
- `## password-recovery.requested event` section (line ~148-150): `which builds the plain-text
  message with events/password-recovery-email.content.ts and sends it through MailService` →
  `which renders the password-recovery mail template and sends it through
  MailService.sendEmailTemplate` (Mail module, direct DI — `AuthModule` imports `MailModule`).
  Leave the best-effort description unchanged.
- If the `## Testing` section lists `password-recovery-email.content.spec.ts`, remove that
  entry (grep shows it currently does not).

## `docs/agents/modules/mail.md`

- Intro paragraph: `First consumer: the password-recovery email ... that calls
  MailService.sendEmail.` → `... that calls MailService.sendEmailTemplate` with the
  `password-recovery` template.
- `## Templates` → `**Boot behaviour**` bullet: the clause `no production template ships yet,
  and a .gitkeep holds the directory` is now stale — reword to note `password-recovery` is the
  first shipped template (and drop / adjust the `.gitkeep` mention to match step 01's choice).
- `## Templates` — add a **Shipped templates** bullet (or short subsection):
  - `password-recovery` — subject `Reset your Kerghan password`; variable `{{resetUrl}}` only;
    no `body.html`. Consumed by `auth/events/password-recovery-requested.listener.ts`
    (best-effort, on `password-recovery.requested`) and `Auth`'s
    `AdminService.sendRecoveryEmail` (synchronous), both via `sendEmailTemplate`.
- `## Testing` — add a line for the new `mail/tests/password-recovery.template.spec.ts` (or
  note the added `render-template.spec.ts` case): the real `password-recovery` template renders
  from `{ resetUrl }`, URL on its own line, the two reassurance sentences present, no `html`,
  and the missing-`resetUrl` throw.

## Files to Change

- `docs/agents/modules/auth.md` — admin-routes paragraph + `password-recovery.requested event`
  section (and `## Testing` if it references the deleted spec).
- `docs/agents/modules/mail.md` — intro paragraph, `## Templates` (boot-behaviour wording +
  new shipped-templates entry), `## Testing`.
