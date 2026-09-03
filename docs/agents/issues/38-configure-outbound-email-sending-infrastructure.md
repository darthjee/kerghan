# Issue: Configure outbound email sending infrastructure

## Description

Kerghan currently has no outbound email infrastructure at all — no mailer dependency, no
SMTP/mail config, nothing. The only precedent is `UserRegisteredEvent`
(`backend/src/auth/events/`), which fires on registration but has no listener yet.

Add a general-purpose mail-sending capability the backend can use for any transactional email,
not just password recovery. The first concrete consumer will be #36's follow-up "send the
recovery email" issue (#39), but this issue is scoped to the **infrastructure only**:

- Add a mail-sending dependency (`nodemailer`) to `backend/package.json`.
- A `MailModule` / `MailService`, exposing a minimal `send({ to, subject, ... })`-style API,
  following this codebase's "simple env-driven config, read once at boot" convention
  (`docs/agents/product.md`) — no hidden env reads inside classes.
- New env vars for SMTP config (host, port, credentials, from-address), documented alongside
  the existing `KERGHAN_*` vars.
- No real email content/templates — that belongs to the consumer issues.
- In non-configured environments (local dev without SMTP set up), sending degrades gracefully
  (log-and-skip) rather than crashing the app, matching the "best-effort / independently
  disable-able by config" pattern described for the recovery flow in #36.

### Out of scope

- Actual recovery email content/trigger — see the follow-up issue on #36 (#39).
- Any other transactional email content (welcome emails, etc).
- Templating engine, attachments, `cc`/`bcc`, multi-recipient — deferred; the API absorbs them
  later without a signature break.
- `package.json` version bump — left to the repo's normal "Bump version" release flow.

## Problem

- No mailer dependency and no SMTP/mail configuration exist in the backend.
- `.env.dev.sample` and `docs/agents/environment-variables.md` already ship reserved,
  **unread** email placeholders (`EMAILS_ENABLED`, `EMAIL_HOST`, `EMAIL_PORT`,
  `EMAIL_HOST_USER`, `EMAIL_HOST_PASSWORD`, `EMAIL_USE_TLS`, `DEFAULT_FROM_EMAIL`) — verbatim
  Django settings names, a leftover from a Django heritage, with no consuming code.
- #39 (send the password-recovery email) is blocked until a reusable mail sender exists.

## Expected Behavior

### Service API shape

```ts
interface SendMailParams {
  to: string;        // single recipient; multi-recipient/cc/bcc deferred
  subject: string;
  text: string;      // plain-text body — always required
  html?: string;     // optional HTML alternative part
  from?: string;     // defaults to KERGHAN_EMAIL_FROM
}

interface SendMailResult {
  status: 'sent' | 'skipped';
  messageId?: string; // present only when status === 'sent'
}

send(params: SendMailParams): Promise<SendMailResult>;
```

- **Async**, returns `Promise<SendMailResult>` (not `void`) so a caller can log "sent" vs
  "skipped" distinctly.
- **`text` always required, `html` optional** — guarantees every message has a plain-text part.
- **`from` defaults to `KERGHAN_EMAIL_FROM`**, applied inside the service from injected config;
  callers normally omit it.
- **Failure semantics — two distinct paths:**
  - *Disabled or not configured* → resolves `{ status: 'skipped' }`, never throws.
  - *Configured but the send fails at runtime* (SMTP down, auth rejected, recipient refused) →
    `send()` **rejects**, propagating the nodemailer error after logging at `error` level.
    Best-effort swallowing is the consumer's responsibility (#39's listener try/catches and
    does not fail the HTTP request), not the infra's.
- **Recipient validation:** light — non-empty string only; format rejection left to nodemailer.

### Graceful degradation

**Enabled detection — explicit flag, not inference.** `enabled = (KERGHAN_EMAILS_ENABLED ===
'true')`, default `false`. Inference from `KERGHAN_EMAIL_HOST` presence is rejected because the
sample ships `EMAIL_HOST=localhost` and would silently enable every dev box.

| `KERGHAN_EMAILS_ENABLED` | Required config present | Behavior |
|---|---|---|
| unset / not `"true"` | — | **Disabled.** Factory builds no transporter. Boot logs the mode once at `log` level. Every `send()` → `{ status: 'skipped' }` + one `debug` line (`email disabled; skipping message to <to> subj=<subject>`). Never throws. |
| `"true"` | yes | **Enabled.** Transporter built once in the factory; `send()` actually sends. |
| `"true"` | **no** (host or from missing) | **Boot throws**, listing the missing vars — the app does not start. |

Fail-fast on the third row: if an operator explicitly set `ENABLED=true`, silently dropping mail
(e.g. every password-recovery email in prod) is worse than refusing to boot. The degradation
intent covers non-configured environments where nobody asked for email.

**Required-when-enabled:** `KERGHAN_EMAIL_HOST`, `KERGHAN_EMAIL_FROM`.
- `KERGHAN_EMAIL_PORT` optional — defaults to `587` (SMTP submission with STARTTLS) when unset;
  `.env.dev.sample` ships it explicitly. Stays overridable.
- `KERGHAN_EMAIL_USER` / `KERGHAN_EMAIL_PASSWORD` optional — `auth` is passed to nodemailer only
  when **both** are non-empty; otherwise omitted (unauthenticated relay).
- `KERGHAN_EMAIL_USE_TLS` optional, defaults `true` when unset.
- `KERGHAN_EMAIL_TIMEOUT_MS` optional — bounds nodemailer's `connectionTimeout` /
  `greetingTimeout` / `socketTimeout` (which otherwise default to ~2 min), so a dead SMTP host
  can't hold a socket open. Defaults to `10000` (10 s) when unset.

**Log levels:** boot mode line at `log`; per-call skip at `debug`; runtime send failure at
`error`. Uses Nest's built-in `Logger` scoped `MailService`.

### Edge cases

| Case | Behavior |
|---|---|
| SMTP unreachable (conn refused / timeout) | `sendMail` rejects (within `KERGHAN_EMAIL_TIMEOUT_MS`, default 10 s) → `send()` logs `error` (recipient + subject + error, **never** the body) and re-rejects. No retry in this issue. |
| SMTP auth rejected (535) at send time | Propagates as a rejection. Distinct from the boot config check — creds can be well-formed but wrong. |
| Recipient refused by server (550) | If `info.accepted` empty / `info.rejected` non-empty → treat as failure, reject with an error naming the rejected address. |
| `to` empty / whitespace-only | Service guard rejects before touching transport: `Error("mail: 'to' is required")`. |
| `to` syntactically garbage | Not validated by us — nodemailer's address parser rejects; propagates. Intentional. |
| `subject` / `text` empty string | Allowed (legal SMTP). Only `to` gets the non-empty guard. |
| `from` omitted + `KERGHAN_EMAIL_FROM` unset | Not reachable: boot throws when enabled without it; when disabled `send()` skips first. |
| Concurrent sends | One shared transporter instance, safe to call concurrently. Non-pooled default is fine for Kerghan's volume; pooling noted as a future tuning knob. |
| Boot-time SMTP connectivity | **No `transporter.verify()` at boot** — adds a network round-trip and a transient blip would block deploys. Only env-var presence is validated; connectivity surfaces at first send. `verify()` noted as an optional future health-check hook. |
| Whitespace in env values | Factory `.trim()`s string env reads (host, from, user). |
| Attachments / oversized body | Out of scope; no size guard. |
| Unicode in subject/body/address | Handled by nodemailer (UTF-8 / IDN). |

## Solution

### Environment variables

Rename the reserved Django-style placeholders into the `KERGHAN_*` namespace, matching every
other var the backend's own code reads (`KERGHAN_SECRET_KEY`, `KERGHAN_MYSQL_*`,
`KERGHAN_ACCESS_TOKEN_TTL_MS`, `KERGHAN_DEMO_PASSWORD`). The un-prefixed vars in this codebase
are all external-platform conventions (`PORT`, `NODE_ENV`) or genuinely cross-cutting
reservations — email transport config is neither; it will be read by Kerghan's own
`MailService`.

| New name | Was (reserved) | Purpose |
|---|---|---|
| `KERGHAN_EMAILS_ENABLED` | `EMAILS_ENABLED` | Master on/off toggle for outbound sending. Default `false`. |
| `KERGHAN_EMAIL_HOST` | `EMAIL_HOST` | SMTP host. Required when enabled. |
| `KERGHAN_EMAIL_PORT` | `EMAIL_PORT` | SMTP port. Optional — defaults to `587` when unset. |
| `KERGHAN_EMAIL_USER` | `EMAIL_HOST_USER` | SMTP auth username (blank = no auth). |
| `KERGHAN_EMAIL_PASSWORD` | `EMAIL_HOST_PASSWORD` | SMTP auth password. |
| `KERGHAN_EMAIL_USE_TLS` | `EMAIL_USE_TLS` | STARTTLS upgrade toggle. Optional — defaults to `true`. |
| `KERGHAN_EMAIL_FROM` | `DEFAULT_FROM_EMAIL` | Default `from` address when a caller doesn't supply one. Required when enabled. |
| `KERGHAN_EMAIL_TIMEOUT_MS` | *(new)* | Bounds nodemailer's connection/greeting/socket timeouts. Optional — defaults to `10000` (10 s). |

`FRONTEND_BASE_URL` stays as-is — it is already wired into `PasswordRecoveryRequestedEvent`'s
`resetUrl` and is cross-cutting, not mail-specific.

Work: rename the 7 lines in `.env.dev.sample`, and rewrite (not merely flip to "Consumed") the
corresponding rows in `docs/agents/environment-variables.md`.

### Module classification & placement

An **Always-on feature module** at `backend/src/mail/`, imported directly into `AppModule`,
exporting `MailService` — mirroring the Auth module and slotting into the documented
inter-module communication pattern (`docs/agents/architecture/modular-pattern.md`) that the #39
recovery-email listener will consume. Owning agent: **backend**.

- **Lazy — ruled out.** Lazy modules load on their controller's first route hit; Mail has no
  HTTP surface, and its consumers (other modules, event listeners) must be able to send at any
  time.
- **Core layer (`src/core/`) — rejected.** `src/core/` holds framework primitives registered as
  bare providers in `AppModule.providers` (there is no `core.module.ts`). Mail has external
  config in its own env namespace, degradation behavior, and its own test surface — it behaves
  like a routeless feature module.

Proposed shape (trimmed standard module):

```
src/mail/
├── mail.module.ts        # imports ConfigModule; a useFactory provider builds a frozen
│                         #   MailConfig + a ready nodemailer Transporter once, from
│                         #   ConfigService; provides + exports MailService
├── mail.config.ts        # pure helpers: buildMailConfig(configService),
│                         #   buildTransportOptions(config) — unit-tested, coverage-counted
├── mail.service.ts       # send() logic; gets transport + config injected, never reads
│                         #   ConfigService per-send
└── tests/
    └── mail.service.spec.ts
```

No controller, dto, or entities. The "read once at boot" config is a `useFactory` provider in
`mail.module.ts` — the same pattern as `app.module.ts`'s TypeORM/JWT factories and
`buildJwtSignOptions` — satisfying product.md's "no hidden env reads inside classes"; the
enabled/config-presence check is resolved at factory time. `events/` is deferred: whether #39's
recovery listener lands in `mail/events/` or `auth/events/` is a #39 decision.

### Dependency choice

`nodemailer` (raw). Add `nodemailer` to `backend/package.json` `dependencies` and
`@types/nodemailer` to `devDependencies`. Wrapped in `MailService` + the boot-time transport
factory.

- Mature de-facto SMTP library, minimal transitive deps, matches the codebase's hand-rolled
  thin-service style (`@nestjs/jwt` is used but surrounding services are custom).
- Ships `jsonTransport` / `streamTransport` — a built-in test seam and a no-network path.
- **`@nestjs-modules/mailer` — rejected:** bundles a template-engine stack that is explicitly
  out of scope, lags Nest majors, and hides the explicit boot-time transport construction. Its
  `forRootAsync` adds nothing over a plain `useFactory` provider.
- **Provider SDKs (SES / SendGrid / Resend / Postmark) — rejected:** vendor lock-in, needs an
  account + API key now, and the reserved env-var set is SMTP-shaped. SMTP stays vendor-neutral
  — any provider exposes SMTP credentials, so the choice can be deferred with no code change.

### Testing strategy

Follows the codebase pattern (`cache-token.service.spec.ts`): plain unit tests that `new` the
class with fakes — no `Test.createTestingModule` for services — with `@swc/jest`, specs under
`tests/`, module wiring coverage-excluded, pure helpers unit-tested.

1. **Inject the transporter — do not `jest.mock('nodemailer')`.** The transporter is built in the
   `mail.module.ts` factory and injected into `MailService`, which never imports nodemailer. Its
   spec uses a fake `{ sendMail: jest.fn() }`.
2. **`tests/mail.service.spec.ts`** (primary) — `new MailService(fakeTransporter, mailConfig)`:
   - enabled + success → `sendMail` called with `{ from, to, subject, text, html }`; returns
     `{ status: 'sent', messageId }`
   - `from` default applied when omitted; caller `from` overrides
   - disabled config → `sendMail` **not** called; returns `{ status: 'skipped' }`; `debug` logged
   - `sendMail` rejects → `send()` rejects, `error` logged, **body absent from the log call args**
   - `accepted` empty / `rejected` non-empty → rejects with the address in the message
   - empty `to` → rejects `"mail: 'to' is required"`, `sendMail` not called
3. **Config helpers spec** (`src/mail/mail.config.ts`) — `KERGHAN_EMAILS_ENABLED`
   unset/`"false"`/`"true"` → `enabled`; enabled + missing `HOST` or `FROM` → throws listing the
   missing vars; `PORT` defaults to `587` when unset; `auth` present only when both user + pass
   set; `USE_TLS` default `true` and the `secure = (port === 465)` / `requireTLS` mapping;
   `TIMEOUT_MS` default `10000` applied to `connectionTimeout`/`greetingTimeout`/`socketTimeout`;
   whitespace trimmed. `mail.module.ts` stays a thin
   `createTransport(buildTransportOptions(...))` call, excluded as wiring like `app.module.ts`.
4. **No real SMTP, no network e2e.** No `mail.*.e2e-spec.ts`. Integration smoke via nodemailer
   `streamTransport`/`jsonTransport` or a local MailHog is explicitly out of scope.

### Security considerations

**Credential handling**
- SMTP user/password from env only, blank in `.env.dev.sample`, never committed.
- The factory must **never log the resolved config / transport-options object** (holds
  `auth.pass`). The boot mode line states enabled/disabled + host only.
- Config kept as a frozen in-memory object; no endpoint exposes it.

**TLS mapping** (`KERGHAN_EMAIL_USE_TLS`, default `true`):
- `secure = (port === 465)` — implicit TLS on connect.
- `requireTLS = useTls && !secure` — forces a STARTTLS upgrade (Django `EMAIL_USE_TLS`
  semantics), fails if the server won't.
- `tls.rejectUnauthorized` stays at nodemailer's default **true**. No env knob to disable it in
  this issue — follow-up if a local relay ever needs it.
- `KERGHAN_EMAIL_USE_TLS=false` + non-465 port → plaintext allowed, local dev only; prod
  expected to enable it. Documented trade-off.

**Header / content injection**
- Light guard: reject `to` / `subject` / `from` containing `\r` or `\n` with a clear error
  (defense-in-depth; nodemailer already encodes header values).
- `text` / `html` are not header vectors. No templates ship here; consumers (#39) pass trusted
  server-composed content. "Don't pass unescaped user-controlled HTML" is a note for consumer
  issues.

**Logging / PII**
- `error` logs carry recipient + subject + error only — **never** `text` / `html`. Success path
  logs nothing above `debug`.

**Abuse / relay**
- No user-facing "send" endpoint; `MailService` sends only what backend code passes it.
  Rate-limiting / enumeration guards belong at the triggering layer (e.g. #36's recovery flow).

**Ops note for the env doc**
- `KERGHAN_EMAIL_FROM` must be an address the configured SMTP server is authorized to send as
  (SPF/DKIM alignment).

### Backward compatibility

- **No runtime behavior change for existing features.** No mail code exists today and nothing
  consumes `MailService` in this issue — Auth, health, JWT, cache-token paths are untouched.
- **Env var rename is safe.** The old names are "Reserved, not yet read" — no code reads them,
  and no real Render/SSH deployment exists yet, so no live `.env.prod` holds them.
- **Adding `MailModule` to `AppModule` imports is boot-safe by default.** `.env.dev.sample`
  ships `KERGHAN_EMAILS_ENABLED=false` → disabled path → no transporter, factory doesn't throw.
  `app.module.spec.ts` and `auth.controller.e2e-spec.ts` (imports `AppModule`) stay green as
  long as the test env doesn't set `KERGHAN_EMAILS_ENABLED=true` — confirm during implementation.
- **`nodemailer` is a new prod dependency** — no Nest peer dep, no collision with the
  `resolutions` block, negligible install/bundle impact.
- **No migration** — no entities, no DB touch.
- **No API surface change** — no routes/DTOs; route docs and the Navi cache-warmer configs
  (`navi/`) are untouched; no `X-Skip-Cache` concern.

### Docs to update

| Doc | Change |
|---|---|
| `docs/agents/environment-variables.md` | Rewrite the two reserved email rows in §1 into 8 individual `KERGHAN_EMAIL_*` rows (incl. the new `KERGHAN_EMAIL_TIMEOUT_MS`), status **Consumed** (`PORT`/`USER`/`PASSWORD`/`USE_TLS`/`TIMEOUT_MS` optional, with `PORT` defaulting to `587`), Source `backend/src/mail/mail.config.ts`. Purpose column carries enabled-detection, TLS mapping, and the SPF/DKIM ops note. `FRONTEND_BASE_URL` unchanged. |
| `.env.dev.sample` | Rename the `# Email settings` lines to `KERGHAN_EMAIL_*` and add `KERGHAN_EMAIL_TIMEOUT_MS=10000`; keep values (`KERGHAN_EMAILS_ENABLED=false`, host `localhost`, port `587`, `KERGHAN_EMAIL_USE_TLS=true`, `KERGHAN_EMAIL_FROM=no-reply@kerghan.local`). |
| `docs/agents/folder-structure.md` | Add a `src/mail/` row to the `backend/` table (→ `docs/agents/modules/mail.md`); update the top-level `backend/` line that says "only the Auth module exists". |
| `docs/agents/architecture/backend.md` | Add `mail/` to the `src/` tree diagram alongside `auth/`. |
| `docs/agents/architecture/modular-pattern.md` | Classification table: add Mail to the **Always-on** row's examples. |
| `docs/agents/modules/mail.md` | **New** — mirrors `auth.md` shape, trimmed: purpose, classification (always-on, no routes/entities), `send()` API contract, three boot states + env vars, degradation/logging, "no templates — consumers own content", link to #39 as first consumer. |
| `docs/agents/summary.md` | Add a one-line abstract for the new `modules/mail.md`. |

Not touched: route docs (`backend/routes/`), Navi configs, proxy docs, `product.md` — no
API/product surface change.

## Benefits

- A single reusable foundation for **all** transactional email, not just password recovery —
  welcome emails, notifications, digests all build on the same `MailService`.
- Unblocks #39 (send the password-recovery email), the first concrete consumer.
- Vendor-neutral: SMTP transport means the actual provider (SES / SendGrid / self-hosted) can
  be chosen or changed later with zero code change.
- Safe by default: disabled unless an operator explicitly sets `KERGHAN_EMAILS_ENABLED=true`,
  and fail-fast on a half-configured "enabled" state so prod never silently drops mail.
- Consistent with existing conventions — `KERGHAN_*` env namespace, "read once at boot" config
  factory, always-on module pattern, codebase test style.

## Related

Surfaced while enhancing #36 (password recovery flow) — the recovery email is the first consumer
of this infrastructure, but this issue is an independent, general-purpose foundation.
