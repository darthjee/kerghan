# Plan: Send password-recovery email when a reset token is created

Issue: [39-send-password-recovery-email-when-a-reset-token-is-created.md](../../issues/39-send-password-recovery-email-when-a-reset-token-is-created.md)

## Overview

Add an `@OnEvent('password-recovery.requested')` listener in the Auth module that composes a
plain-text recovery email (via a pure `buildPasswordRecoveryEmail` builder) and sends it through
#38's `MailService`. The event payload gains an `email` field (populated at the existing emit
site in `PasswordResetService#recover`) so the listener needs no database lookup; `AuthModule`
imports `MailModule`. Delivery is best-effort — the listener catches every error, treats a
disabled-mail `skipped` result as normal, and never lets a send failure touch the
already-responded `/auth/recover.json` request. Also covers docstring/doc cleanup.

See [backend.md](backend.md) for the full plan.
