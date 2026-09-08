# Plan: Backend: migrate the password-recovery email onto a mail template

Issue: [73-backend-migrate-the-password-recovery-email-onto-a-mail-template.md](../../issues/73-backend-migrate-the-password-recovery-email-onto-a-mail-template.md)

## Overview

Make the password-recovery email the first real consumer of the filesystem mail-template
system landed in #75. Move its subject and body into a `password-recovery` template, repoint
the two call sites (`password-recovery-requested.listener.ts` and
`AdminService.sendRecoveryEmail`) from the bespoke `buildPasswordRecoveryEmail` helper +
`sendEmail` onto `MailService.sendEmailTemplate`, delete the helper and its spec, move the
subject/body coverage into a mail-template spec, and update the Auth and Mail module docs.
Observable behaviour is unchanged (same subject, same copy, same best-effort listener, same
synchronous `sent`/`skipped` on the admin path).

All work is inside `backend/` and owned by the **backend** agent.

See [backend.md](backend.md) for the full plan.
