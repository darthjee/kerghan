# Plan: Refactor: dedupe sendEmail/sendEmailTemplate in mail.service.ts and mail.service.spec.ts

Issue: [171-refactor-dedupe-sendemail-sendemailtemplate-in-mail-service-ts-and-mail-service-spec-ts.md](../../issues/171-refactor-dedupe-sendemail-sendemailtemplate-in-mail-service-ts-and-mail-service-spec-ts.md)

## Overview
Pure backend refactor inside `backend/src/mail/`: extract the shared method-resolution / enabled-check prologue of `MailService` into one private helper, and collapse the duplicated spec cases into a `describe.each` over both entry points.

See [backend.md](backend.md) for the full plan.
