# Backend Plan: Backend: email send-method abstraction (native) + KERGHAN_EMAIL_METHOD + rename send() to sendEmail()

Main plan: [plan.md](plan.md)

## Steps

- [01 — Add the EmailMethod seam and NativeEmailMethod](backend/01-add-email-method-seam.md)
- [02 — Wire the method registry into MailModule](backend/02-wire-method-registry.md)
- [03 — Add KERGHAN_EMAIL_METHOD to MailConfig](backend/03-add-email-method-config.md)
- [04 — Rename send() to sendEmail() with method resolution](backend/04-rename-send-to-sendemail.md)
- [05 — Update callers to sendEmail](backend/05-update-callers.md)
- [06 — Update env samples and docs](backend/06-update-env-and-docs.md)

## CI Checks

- `backend`: `docker-compose run --rm kerghan_tests yarn coverage` (CI job: `backend_tests`)
- `backend`: `docker-compose run --rm kerghan_tests yarn lint` (CI job: `backend_checks`)

## Notes

- Only `native` is registered — no real provider, no `sendEmailTemplate`/template rendering
  (that's #70 sub-issue 2), and no migration of the password-recovery email off its bespoke
  content builder (that's #70 sub-issue 3).
- The known-method-names list (currently just `['native']`) must be validated in
  `mail.config.ts` against the same names the registry in `mail.module.ts` actually provides —
  keep them declared in one shared place (e.g. exported from `mail.method.ts` or
  `mail.tokens.ts`) rather than duplicating the literal array in both files.
- No multi-recipient/cc/bcc/attachments/reply-to or retry/queueing — unchanged from #38's
  deferrals.
