# Rename send() to sendEmail() with method resolution

In `mail.service.ts`, replace `SendMailParams`/`SendMailResult`/`send` with `SendEmailParams` /
`SendEmailResult` / `sendEmail`, matching the issue's shape: `SendEmailParams` is `{ to, subject,
body, html?, from?, method? }` (the plain-text field is renamed `text` → `body`); `SendEmailResult`
adds a `method` field alongside the existing `status`/`messageId`. Inject `MAIL_METHODS` (from
step 02) into the constructor and keep it alongside the existing `transporter`/`config`/`logger`
fields (or drop the direct `transporter` field entirely if nothing else needs it — check step 02's
final shape).

`sendEmail` resolves `method = params.method ?? config.method` **before** the disabled check, and
throws `mail: unknown method: <name>` if it's not in the known-names list — before any transport
work, including before the disabled short-circuit (an unknown method is always an error, disabled
or not). Disabled mail (`!config.enabled`) still resolves `{ status: 'skipped', method }` without
touching a method/transport, and the existing `debug` skip log gains a `method` attribute.
Enabled mail's `#deliver` now calls `this.methods[method].deliver({ from, to, subject, text: body,
html })` instead of `this.transporter.sendMail(...)` — `NativeEmailMethod.deliver` still expects
its `text` param (that interface is unchanged from step 01), only `MailService`'s own public
params are renamed. A `deliver` rejection still rejects `sendEmail` after the existing `error` log
(now carrying `method`, body still not logged). Success returns `{ status: 'sent', method,
messageId }`. Keep `#assertSendable`'s existing guards (`to` required, `to`/`subject`/`from`
newline check) unchanged.

Rework `mail.service.spec.ts` onto `sendEmail`: success path asserts the resolved method's
`deliver` was called with `{ from, to, subject, text, html }` and returns `{ status: 'sent',
method: 'native', messageId }`; `from` fallback/override; disabled → `{ status: 'skipped', method
}`, `deliver` not called, `debug` log carries `method`; `deliver` rejects → `sendEmail` rejects,
`error` log carries `method`, body not logged; recipient-rejected propagates (via the moved
`NativeEmailMethod` behavior from step 01 — this spec can use a fake `EmailMethod` double instead
of a fake transporter now that `MailService` no longer holds the transporter directly); empty
`to` / header-newline guards unchanged; unknown per-call `method` → throws, no `deliver` call, and
same for the disabled path (unknown method still throws even though nothing else happens).

## Files to Change

- `backend/src/mail/mail.service.ts` — `SendEmailParams`/`SendEmailResult`, `sendEmail` replacing
  `send`, method resolution + unknown-method throw, `#deliver` delegating to the resolved
  `EmailMethod`.
- `backend/src/mail/tests/mail.service.spec.ts` — reworked spec suite described above.
