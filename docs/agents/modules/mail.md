# Module — Mail

Kerghan's general-purpose transactional-email sender. **Always-on** — imported directly into
`AppModule` (see `docs/agents/architecture/modular-pattern.md`'s classification), not
lazy-loaded. It has **no HTTP surface** (no controller, routes, DTOs, entities, or migrations);
other modules and event listeners consume it through the exported `MailService`, injected via
direct DI. First consumer: the password-recovery email (see
[#39](../issues/39-send-password-recovery-email-when-a-reset-token-is-created.md)), an
`@OnEvent('password-recovery.requested')` listener in the **Auth** module
(`backend/src/auth/events/password-recovery-requested.listener.ts`) that calls
`MailService.sendEmail`.

## Configuration

All configuration comes from the `KERGHAN_EMAIL_*` env vars (see
[`environment-variables.md`](../environment-variables.md)), read **once at boot** by
`mail.config.ts`'s `buildMailConfig` — no class reads `process.env`. `mail.module.ts` is the only
file that imports `nodemailer`; it turns the resolved config into a `nodemailer.Transporter`
(or `null`) and, from that, builds the `EmailMethod` registry (see **Send methods** below)
injected into `MailService` alongside the frozen `MailConfig`.

Three boot states:

- **Disabled** — `KERGHAN_EMAILS_ENABLED` is anything other than `'true'` (the default). No
  transporter is created; `MailService.sendEmail` logs and skips. `KERGHAN_EMAIL_METHOD` is still
  resolved and validated on this path (see **Send methods**).
- **Enabled** — `KERGHAN_EMAILS_ENABLED='true'` with a valid `KERGHAN_EMAIL_HOST` and
  `KERGHAN_EMAIL_FROM`. The transporter is built: `465` ⇒ implicit TLS (`secure`), other ports ⇒
  STARTTLS forced when `KERGHAN_EMAIL_USE_TLS` (default `true`); `auth` is sent only when both
  `KERGHAN_EMAIL_USER` and `KERGHAN_EMAIL_PASSWORD` are set; connection/greeting/socket timeouts
  are bounded by `KERGHAN_EMAIL_TIMEOUT_MS` (default `10000`). When SMTP credentials are
  configured, `KERGHAN_EMAIL_USE_TLS=false` is ignored on non-465 ports — STARTTLS stays
  required so the credentials are never offered over a plaintext fallback.
- **Enabled but misconfigured** — enabled with a missing/invalid required var, or an unknown
  `KERGHAN_EMAIL_METHOD`. `buildMailConfig` throws at boot, naming every offending var.

## API

`MailService.sendEmail(params: SendEmailParams): Promise<SendEmailResult>`

- `SendEmailParams` — `{ to, subject, body, html?, from?, method? }`. `from` defaults to
  `KERGHAN_EMAIL_FROM`; `method` defaults to `KERGHAN_EMAIL_METHOD` (see **Send methods**).
- `SendEmailResult` — `{ status: 'sent', method, messageId }` or `{ status: 'skipped', method }`.
  `method` always names whichever `EmailMethod` was resolved, on both outcomes.
- When email is **disabled**, `sendEmail` never throws for that reason — it returns
  `{ status: 'skipped', method }` without touching a method/transport. An unknown `method` still
  throws even when disabled (see **Send methods**).
- When email is **enabled**, a send that the resolved method rejects (or that throws) **rejects**
  the promise. Best-effort swallowing is the caller's decision, not the module's.
- Guards: an empty `to` rejects with `mail: 'to' is required`; a `\r`/`\n` in `to`, `subject`, or
  the effective `from` rejects with `mail: header field contains a newline` (header-injection
  protection).

## Send methods

Delivery is abstracted behind the `EmailMethod` interface (`mail.method.ts`): one async
`deliver({ from, to, subject, text, html })` resolving to `{ messageId? }` or rejecting.
`mail.module.ts` builds a registry — a plain object keyed by method name — from the boot-time
transporter, and injects it into `MailService` as `MAIL_METHODS`.

- **`native`** (`NativeEmailMethod`) — the only registered method today. Delivers through the
  injected nodemailer `Transporter`; a `sendMail` result with an empty `accepted` and a non-empty
  `rejected` throws `mail: recipient rejected: <addrs>`.
- **`KERGHAN_EMAIL_METHOD`** selects the default method (`native` when unset/blank); `mail.config.ts`
  validates it against the same known-method-names list the registry is built from
  (`MAIL_METHOD_NAMES` in `mail.tokens.ts`), so the two can't drift. An unknown configured value
  throws at boot, alongside any other missing/invalid var.
- `SendEmailParams.method` overrides the configured default for one call. `MailService.sendEmail`
  resolves `method = params.method ?? config.method` and validates it against the registry
  **before** the disabled short-circuit and before any transport work — an unknown method always
  throws `mail: unknown method: <name>`, disabled or not.
- No other method is registered yet — no real provider beyond `native`, and no
  `sendEmailTemplate`/template rendering (tracked separately).

## No templates

Message content — subject, plain-text body, optional HTML body — is entirely the caller's
responsibility. The Mail module ships no templating engine or layout.

## Logging

- Boot: one `log` line stating `enabled` (with the host) or `disabled` — never the whole config
  object, which holds the SMTP password.
- Per call, when disabled: one `debug` line with the recipient, subject, and resolved `method`.
- On send failure: one `error` line with the recipient, subject, and resolved `method`. Message
  `body`/`html` and credentials are never logged.

## Testing

- `mail/tests/mail.config.spec.ts` — unit specs for `buildMailConfig`: disabled/enabled
  resolution, required-var validation (including `KERGHAN_EMAIL_METHOD`), and the
  port/TLS/auth/timeout mapping, with a fake `ConfigService`.
- `mail/tests/mail.method.spec.ts` — unit specs for `NativeEmailMethod.deliver`: the `sendMail`
  call shape, the resolved `messageId`, and the recipient-rejection throw.
- `mail/tests/mail.service.spec.ts` — unit specs that `new MailService(config, fakeMethods,
  logger)`: successful `sendEmail` (default and per-call `method`), `from` fallback/override, the
  disabled skip path, delivery-failure logging (asserting the bodies are not leaked), recipient
  rejection, the `to`/header-injection guards, and the unknown-method throw (both enabled and
  disabled).
