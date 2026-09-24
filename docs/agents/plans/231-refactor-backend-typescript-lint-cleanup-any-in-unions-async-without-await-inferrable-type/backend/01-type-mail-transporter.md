# Type the mail transporter precisely
Declare a single local type alias for the concrete transporter nodemailer returns, e.g.:

```ts
import type SMTPTransport from 'nodemailer/lib/smtp-transport/index.js';
export type MailTransporter = Transporter<SMTPTransport.SentMessageInfo, SMTPTransport.Options>;
```

(Adjust the import specifier to whatever resolves under the project's module settings.) Export it from `mail.method.ts` (the lower-level module that `mail.module.ts` already imports from) and use it:

- in `mail.module.ts` at the four `Transporter | null` sites (`createMailTransport` return type, `createMailMethods` parameter, both `useFactory` signatures) and the `as Transporter` cast in `createMailMethods`;
- in `mail.method.ts` for `NativeEmailMethod`'s `transporter` field and constructor parameter.

Update the matching JSDoc `@param`/`@returns` types. `NativeEmailMethod#deliver` reads `info.rejected`, `info.accepted`, and `info.messageId` — all present on `SMTPTransport.SentMessageInfo`, so it should type-check unchanged. Adjust spec mocks only if they now fail to type-check (e.g. cast to the alias instead of `Transporter`).

## Files to Change
- `backend/src/mail/mail.method.ts` — add/export `MailTransporter` alias; use it in `NativeEmailMethod`.
- `backend/src/mail/mail.module.ts` — replace `Transporter` with `MailTransporter` at lines 27, 51, 53, 74, 80 and JSDoc.
- `backend/src/mail/tests/*.spec.ts` — only if mocks need the new type.
