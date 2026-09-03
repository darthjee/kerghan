# mail.config.ts: boot-time config + transport-options helpers

Create `backend/src/mail/mail.config.ts` holding the pure functions the module factory delegates
to, so they are unit-testable and coverage-counted (unlike `mail.module.ts`, which is excluded
as wiring). No NestJS decorators here — plain functions and types.

## Exports

### `interface MailConfig`

Frozen, plain data. Suggested shape:

```ts
export interface MailConfig {
  enabled: boolean;
  from: string;            // '' when disabled
  transport: TransportOptions | null;  // null when disabled
}
```

`TransportOptions` is the object passed to `nodemailer.createTransport` — type it as
`SMTPTransport.Options` from `nodemailer/lib/smtp-transport` (or a local structural type if that
import is awkward under NodeNext).

### `buildMailConfig(configService: ConfigService): MailConfig`

1. `enabled = configService.get<string>('KERGHAN_EMAILS_ENABLED') === 'true'` (exact string
   match; any other value — unset, `"false"`, `"1"`, `"yes"` — is `false`).
2. **Disabled** → return `Object.freeze({ enabled: false, from: '', transport: null })`.
3. **Enabled** → read and `.trim()` string vars:
   - `host = KERGHAN_EMAIL_HOST` (required)
   - `from = KERGHAN_EMAIL_FROM` (required)
   - `port = Number(KERGHAN_EMAIL_PORT ?? '587')` — default `587` when unset/blank
   - `user = KERGHAN_EMAIL_USER` (optional), `pass = KERGHAN_EMAIL_PASSWORD` (optional)
   - `useTls = (KERGHAN_EMAIL_USE_TLS ?? 'true') !== 'false'` — default `true`
   - `timeoutMs = Number(KERGHAN_EMAIL_TIMEOUT_MS ?? '10000')`
4. **Validation** — collect the names of every missing required var (`KERGHAN_EMAIL_HOST`,
   `KERGHAN_EMAIL_FROM` when blank/unset; also `KERGHAN_EMAIL_PORT` only if it is set but not a
   finite positive number, and `KERGHAN_EMAIL_TIMEOUT_MS` likewise if set-but-invalid). If the
   list is non-empty, `throw new Error('mail: KERGHAN_EMAILS_ENABLED is true but the following
   are missing/invalid: <comma-separated list>')`.
5. Return `Object.freeze({ enabled: true, from, transport: buildTransportOptions({ host, port,
   user, pass, useTls, timeoutMs }) })`.

### `buildTransportOptions(input): SMTPTransport.Options`

Maps validated primitives to nodemailer options:

- `host`, `port`
- `secure: port === 465` — implicit TLS on connect
- `requireTLS: useTls && port !== 465` — force STARTTLS upgrade, fail if unsupported
- `auth: user && pass ? { user, pass } : undefined` — omit entirely unless **both** are non-empty
- `connectionTimeout: timeoutMs`, `greetingTimeout: timeoutMs`, `socketTimeout: timeoutMs`
- Leave `tls.rejectUnauthorized` at nodemailer's default (do not set it) so invalid certs are
  rejected.

Keep the file well under 300 lines / complexity 10. `buildMailConfig`'s validation branch is the
only place complexity could creep — factor the "missing required" collection into a tiny local
helper if the linter complains.

## Files to Change

- `backend/src/mail/mail.config.ts` — new
