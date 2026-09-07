# Plan: Backend: sendEmailTemplate + filesystem email templates + renderTemplate helper

Issue: [72-backend-sendemailtemplate-filesystem-email-templates-rendertemplate-helper.md](../../issues/72-backend-sendemailtemplate-filesystem-email-templates-rendertemplate-helper.md)

## Overview

Add a filesystem email-template system to the already-shipped Mail module: templates live under
`backend/src/mail/templates/<name>/` as `subject.txt` / `body.txt` / optional `body.html`,
scanned into a frozen registry at boot. A pure `renderTemplate` helper interpolates
`{{variable}}` placeholders (HTML-escaping only in `body.html`), and `MailService.sendEmailTemplate`
renders then delegates to a private send path shared with `sendEmail` — with the disabled-mail
short-circuit evaluated **before** rendering. All work is inside `backend/` (code, tests,
`nest-cli.json`, and the `docs/agents/` module/architecture docs), so it is owned by a single
agent.

See [backend.md](backend.md) for the full plan.
