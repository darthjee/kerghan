# Module — Mail

Kerghan's general-purpose transactional-email sender. **Always-on** — imported directly into
`AppModule` (see `docs/agents/architecture/modular-pattern.md`'s classification), not
lazy-loaded. It has **no HTTP surface** (no controller, routes, DTOs, entities, or migrations);
other modules and event listeners consume it through the exported `MailService`, injected via
direct DI. First consumer: the password-recovery email (see
[#39](../issues/39-send-password-recovery-email-when-a-reset-token-is-created.md)), an
`@OnEvent('password-recovery.requested')` listener in the **Auth** module
(`backend/src/auth/events/password-recovery-requested.listener.ts`) that calls
`MailService.send`.

## Configuration

All configuration comes from the `KERGHAN_EMAIL_*` env vars (see
[`environment-variables.md`](../environment-variables.md)), read **once at boot** by
`mail.config.ts`'s `buildMailConfig` — no class reads `process.env`. `mail.module.ts` is the only
file that imports `nodemailer`; it turns the resolved config into a `nodemailer.Transporter`
(or `null`) and injects it into `MailService` alongside the frozen `MailConfig`.

Three boot states:

- **Disabled** — `KERGHAN_EMAILS_ENABLED` is anything other than `'true'` (the default). No
  transporter is created; `MailService.send` logs and skips.
- **Enabled** — `KERGHAN_EMAILS_ENABLED='true'` with a valid `KERGHAN_EMAIL_HOST` and
  `KERGHAN_EMAIL_FROM`. The transporter is built: `465` ⇒ implicit TLS (`secure`), other ports ⇒
  STARTTLS forced when `KERGHAN_EMAIL_USE_TLS` (default `true`); `auth` is sent only when both
  `KERGHAN_EMAIL_USER` and `KERGHAN_EMAIL_PASSWORD` are set; connection/greeting/socket timeouts
  are bounded by `KERGHAN_EMAIL_TIMEOUT_MS` (default `10000`). When SMTP credentials are
  configured, `KERGHAN_EMAIL_USE_TLS=false` is ignored on non-465 ports — STARTTLS stays
  required so the credentials are never offered over a plaintext fallback.
- **Enabled but misconfigured** — enabled with a missing/invalid required var. `buildMailConfig`
  throws at boot, naming every offending var.

## API

`MailService.send(params: SendMailParams): Promise<SendMailResult>`

- `SendMailParams` — `{ to, subject, text, html?, from? }`. `from` defaults to
  `KERGHAN_EMAIL_FROM`.
- `SendMailResult` — `{ status: 'sent', messageId }` or `{ status: 'skipped' }`.
- When email is **disabled**, `send` never throws — it returns `{ status: 'skipped' }` without
  touching the transporter.
- When email is **enabled**, a send that the transport rejects (or that throws) **rejects** the
  promise. Best-effort swallowing is the caller's decision, not the module's.
- Guards: an empty `to` rejects with `mail: 'to' is required`; a `\r`/`\n` in `to`, `subject`, or
  the effective `from` rejects with `mail: header field contains a newline` (header-injection
  protection).

## No templates

Message content — subject, plain-text body, optional HTML body — is entirely the caller's
responsibility. The Mail module ships no templating engine or layout.

## Logging

- Boot: one `log` line stating `enabled` (with the host) or `disabled` — never the whole config
  object, which holds the SMTP password.
- Per call, when disabled: one `debug` line with the recipient and subject.
- On send failure: one `error` line with the recipient and subject. Message `text`/`html` and
  credentials are never logged.

## Testing

- `mail/tests/mail.config.spec.ts` — unit specs for `buildMailConfig`: disabled/enabled
  resolution, required-var validation, and the port/TLS/auth/timeout mapping, with a fake
  `ConfigService`.
- `mail/tests/mail.service.spec.ts` — unit specs that `new MailService(fakeTransporter, config)`:
  successful send, `from` fallback/override, the disabled skip path, transport-failure logging
  (asserting the bodies are not leaked), recipient rejection, and the `to`/header-injection
  guards.
