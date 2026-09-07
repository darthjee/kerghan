# Wire the method registry into MailModule

Add a `MAIL_METHODS` DI token in `mail.tokens.ts` (same pattern as the existing `MAIL_CONFIG` /
`MAIL_TRANSPORT` tokens — a plain string constant, kept out of `mail.module.ts` to avoid the
module/service import cycle). This is also the natural place to export the shared known-method-
names list (e.g. `MAIL_METHOD_NAMES = ['native']`) that both `mail.config.ts` (step 03) and this
registry factory read, so the two never drift.

In `mail.module.ts`, add a `MAIL_METHODS` provider via `useFactory` (`inject: [MAIL_TRANSPORT]`)
that builds `{ native: new NativeEmailMethod(transport) }` — a plain object keyed by method name,
constructed once at boot regardless of whether mail is enabled (the transport is `null` when
disabled, which is fine since `NativeEmailMethod` is never invoked in that case). Inject
`MAIL_METHODS` into `MailService`'s constructor alongside the existing `MAIL_TRANSPORT` /
`MAIL_CONFIG` / `LoggerService` params (step 04 uses it).

## Files to Change

- `backend/src/mail/mail.tokens.ts` — add the `MAIL_METHODS` token (and, if this is where the
  shared list lives, `MAIL_METHOD_NAMES`).
- `backend/src/mail/mail.module.ts` — add the `MAIL_METHODS` provider factory; wire it into
  `MailService`'s injected params.
