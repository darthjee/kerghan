# Plan: Backend: email send-method abstraction (native) + KERGHAN_EMAIL_METHOD + rename send() to sendEmail()

Issue: [71_backend--email-send-method-abstraction--native----kerghan-email-method---rename-send---to-sendemail-.md](../../issues/71-backend--email-send-method-abstraction--native----kerghan-email-method---rename-send---to-sendemail-.md)

## Overview

Introduces a send-method abstraction in `backend/src/mail/`: an `EmailMethod` interface, a
`NativeEmailMethod` wrapping the current nodemailer transport, and a name-keyed registry selected
via the new `KERGHAN_EMAIL_METHOD` env var. `MailService.send()` is renamed to `sendEmail()` with
the `{ to, subject, body, html?, from?, method? }` shape, delegating to the resolved method. Both
existing callers move to the new API. Only `native` ships — this lands the seam, not a provider.

See [backend.md](backend.md) for the full plan.
