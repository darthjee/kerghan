# Plan: Configure outbound email sending infrastructure

Issue: [38-configure-outbound-email-sending-infrastructure.md](../issues/38-configure-outbound-email-sending-infrastructure.md)

## Overview

Build a general-purpose, always-on `MailModule` / `MailService` at `backend/src/mail/` — a thin
`nodemailer` wrapper with a boot-time transport factory, an async
`send({ to, subject, text, html?, from? }) → { status, messageId? }` API, and no email
content/templates (those belong to consumer issues such as #39). Configuration is a renamed
`KERGHAN_EMAIL_*` env namespace read once at boot, with three degradation states: disabled by
default (log-and-skip, never throws), enabled-and-configured (sends), or enabled-but-missing
required config (boot fails fast). All work lands inside the `backend` specialist's scope.

See [backend.md](backend.md) for the full plan.
