# Plan: Log the email-enabled flag check on every send attempt

Issue: [53-log-the-email-enabled-flag-check-on-every-send-attempt.md](../../issues/53-log-the-email-enabled-flag-check-on-every-send-attempt.md)

## Overview

`MailService` already logs a `debug`-level line when a send is skipped because outbound mail is
disabled (`#skip()`, with existing test coverage). It has no matching line for the enabled path.
This plan adds that missing "enabled, proceeding" debug log to the shared private `#send()`
method — the single point both `sendEmail` and `sendEmailTemplate` reach once the enabled-check
has passed — and covers it with a unit spec.

See [backend.md](backend.md) for the full plan.
