# Plan: Refactor: Fix object-injection lookups and dead conditional in mail.service.ts

Issue: [207-refactor-fix-object-injection-lookups-and-dead-conditional-in-mail-service-ts.md](../../issues/207-refactor-fix-object-injection-lookups-and-dead-conditional-in-mail-service-ts.md)

## Overview

`MailService` indexes its injected `Record<string, EmailMethod>` with a dynamic key twice
(`#deliver`, `#assertKnownMethod`), which trips `security/detect-object-injection`, and since the
`Record` type claims the lookup can never be `undefined`, the runtime "unknown method" guard also
trips `no-unnecessary-condition`. This is a self-contained internal refactor of one backend file.

See [backend.md](backend.md) for the full plan.
