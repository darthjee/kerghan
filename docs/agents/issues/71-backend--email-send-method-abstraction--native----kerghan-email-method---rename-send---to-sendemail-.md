# Issue: Backend: email send-method abstraction (native) + KERGHAN_EMAIL_METHOD + rename send() to sendEmail()

## Description

Split from #70 (see that issue for the full design rationale and the complete sub-issue list).
Depends on nothing — this is the foundational step that unblocks #70 sub-issues 2 and 3.

Kerghan's Mail module (`backend/src/mail/`) sends through a single hard-wired nodemailer/SMTP
transport: `mail.module.ts` builds one `nodemailer.Transporter` and `MailService.send({ to,
subject, text, html?, from? })` talks to it directly. This sub-issue introduces a **send-method
abstraction** so a message can be routed through a named sender, adds the `KERGHAN_EMAIL_METHOD`
env var to pick the default, and renames the public method to `sendEmail` with the `{ to,
subject, body, ... }` shape #70 settled on. `native` (the current transport) is the only method
that ships — the deliverable is the seam, not a provider.

No behaviour changes beyond the rename and the (currently single-valued) method resolution.

## Problem

- **Transport is hard-wired.** There is no way to route mail through anything other than the one
  SMTP transport without editing `MailService`. A future transactional provider (Mandrill, SES,
  …) or a dev/no-op sink cannot be slotted in, and the choice cannot be made per environment or
  per call.
- **`send()` carries no method concept** and its `{ to, subject, text }` shape does not match the
  `sendEmail` / `sendEmailTemplate` API #70 defines.
- **No `KERGHAN_EMAIL_METHOD`.** `environment-variables.md` documents `KERGHAN_EMAILS_ENABLED`
  and the SMTP `KERGHAN_EMAIL_*` set, but nothing selects *how* mail is sent.

## Expected Behavior

### Method abstraction

- An `EmailMethod` interface — one async `deliver({ from, to, subject, text, html })` returning
  `{ messageId? }` (or rejecting).
- `NativeEmailMethod` implements it by wrapping the injected `Transporter`, preserving the
  current `info.accepted` / `info.rejected` handling (empty `accepted` + non-empty `rejected` →
  `mail: recipient rejected: <addrs>`).
- A registry keyed by method name (`{ native: NativeEmailMethod }`), wired in `mail.module.ts`
  as a provider alongside the existing `MAIL_CONFIG` / `MAIL_TRANSPORT` factories, with its own
  token in `mail.tokens.ts`.

### Config

- `MailConfig` gains `method: string`. `buildMailConfig` reads `KERGHAN_EMAIL_METHOD` (trimmed,
  default `native` when unset/blank) and **throws at boot** when the value is not a registered
  method name, listing it in the same "missing/invalid" error the enabled-but-misconfigured path
  already produces. The disabled path keeps `method: 'native'` (or the resolved value) but still
  validates it.

### Service API

```ts
interface SendEmailParams {
  to: string;
  subject: string;
  body: string;      // plain-text part — always required (was `text`)
  html?: string;
  from?: string;     // defaults to KERGHAN_EMAIL_FROM
  method?: string;   // defaults to config.method (KERGHAN_EMAIL_METHOD, then 'native')
}

interface SendEmailResult {
  status: 'sent' | 'skipped';
  method: string;
  messageId?: string;
}

sendEmail(params: SendEmailParams): Promise<SendEmailResult>;
```

- `send()` is removed; `sendEmail` replaces it.
- Method resolution: `params.method ?? config.method`. An unknown resolved method → **throw**
  (`mail: unknown method: <name>`), before any transport work.
- **Disabled** (`KERGHAN_EMAILS_ENABLED` not `'true'`): resolves `{ status: 'skipped', method }`
  without touching a method/transport — unchanged from today, plus the `method` field and the
  existing `debug` skip log (now carrying `method`).
- **Enabled**: delegates to the resolved method's `deliver(...)`; a rejection/throw rejects
  `sendEmail` after the existing `error` log (now carrying `method`); success →
  `{ status: 'sent', method, messageId }`.
- Existing guards unchanged: empty `to` → `mail: 'to' is required`; `\r`/`\n` in `to` /
  `subject` / effective `from` → `mail: header field contains a newline`.

### Callers

- `backend/src/auth/events/password-recovery-requested.listener.ts` and
  `AdminService.sendRecoveryEmail` switch `send({ to, subject, text })` →
  `sendEmail({ to, subject, body })`. Behaviour (listener best-effort, admin sync
  `sent`/`skipped`) is unchanged.

## Solution

### Scope

The `EmailMethod` seam + `NativeEmailMethod` + registry, the `KERGHAN_EMAIL_METHOD` config plumb
(with fail-fast validation), the `send()` → `sendEmail()` rename to the `{ to, subject, body,
html?, from?, method? }` shape returning `SendEmailResult`, the two caller updates, and the
matching spec + doc changes.

**Explicitly out of scope**

- **`sendEmailTemplate`, templates, `renderTemplate`** — #70 sub-issue 2.
- **Migrating the password-recovery email off its bespoke builder** — #70 sub-issue 3.
- **Any real provider** (Mandrill / SES / …). Only `native` is registered.
- **Multi-recipient / cc / bcc / attachments / reply-to**, retry/queueing — unchanged from #38's
  deferrals.

### What needs to be done

**`backend/src/mail/`**

- `mail.method.ts` (new) — `EmailMethod` interface + `NativeEmailMethod`. `NativeEmailMethod`
  takes the `Transporter` (injected; `null` only reachable when disabled, which `sendEmail`
  short-circuits before calling a method).
- `mail.tokens.ts` — add a `MAIL_METHODS` (registry) token.
- `mail.module.ts` — provide the registry via `useFactory` (`inject: [MAIL_TRANSPORT]`, builds
  `{ native: new NativeEmailMethod(transport) }`); inject it into `MailService`.
- `mail.config.ts` — add `method` to `MailConfig` + `TransportOptionsInput` isn't affected;
  `buildMailConfig` reads/validates `KERGHAN_EMAIL_METHOD` against the known method names
  (`['native']` for now, kept in one place shared with the registry).
- `mail.service.ts` — replace `SendMailParams`/`send` with `SendEmailParams`/`sendEmail`; add
  `method` resolution + unknown-method throw; thread `method` into the `debug`/`error` log
  attributes and into `SendEmailResult`. `#deliver` calls `this.methods[method].deliver(...)`
  instead of `this.transporter.sendMail(...)`.

**`backend/src/auth/`**

- `events/password-recovery-requested.listener.ts`, `admin.service.ts` — `send(...)` →
  `sendEmail(...)`, `text:` → `body:`.

**Tests (`backend/src/mail/tests/`, `backend/src/auth/tests/`)**

- `mail.config.spec.ts` — `KERGHAN_EMAIL_METHOD` unset → `native`; `'native'` → `native`;
  unknown value → throws listing it (enabled and disabled).
- `mail.service.spec.ts` — rework onto `sendEmail`: success (method `deliver` called with
  `{ from, to, subject, text, html }`, result `{ status: 'sent', method: 'native', messageId }`);
  `from` fallback/override; disabled → `{ status: 'skipped', method }`, `deliver` not called,
  `debug` carries `method`; `deliver` rejects → `sendEmail` rejects, `error` carries `method`,
  body not logged; recipient-rejected propagates; empty `to` / header-newline guards; unknown
  per-call `method` → throws, no `deliver` call.
- `mail.method.spec.ts` (new) — `NativeEmailMethod.deliver` maps to `transporter.sendMail` and
  applies the `accepted`/`rejected` check.
- `password-recovery-requested.listener.spec.ts`, `admin.service.spec.ts` — update the mail
  double + assertions to `sendEmail` / `body`.

**Config / docs**

- `.env.dev.sample` — add `KERGHAN_EMAIL_METHOD=native` to the email block.
- `.env` — add `KERGHAN_EMAIL_METHOD=native`, and rename the stale Django-style
  `EMAILS_ENABLED` / `EMAIL_HOST` / `EMAIL_PORT` / `EMAIL_HOST_USER` / `EMAIL_HOST_PASSWORD` /
  `EMAIL_USE_TLS` / `DEFAULT_FROM_EMAIL` block to the `KERGHAN_EMAIL_*` names the code reads.
- `docs/agents/environment-variables.md` — new `KERGHAN_EMAIL_METHOD` row (Consumed, optional,
  default `native`, source `backend/src/mail/mail.config.ts`).
- `docs/agents/modules/mail.md` — rewrite the **API** section for `sendEmail` / `SendEmailResult`
  and add a **Send methods** section (`native` only, `KERGHAN_EMAIL_METHOD`, fail-fast).

### Acceptance criteria

- [ ] An `EmailMethod` interface + `NativeEmailMethod` + a name-keyed registry exist; `native`
      wraps the current nodemailer transport with the current `accepted`/`rejected` handling.
- [ ] `MailService.sendEmail({ to, subject, body, html?, from?, method? })` replaces `send()`,
      returns `{ status, method, messageId? }`, and both existing callers use it.
- [ ] `KERGHAN_EMAIL_METHOD` sets the default method (default `native` when unset); an unknown
      value throws at boot naming it; an unknown per-call `method` throws from `sendEmail` before
      any transport work.
- [ ] Disabled mail still resolves `{ status: 'skipped', method }` without touching a
      method/transport and never throws; empty-`to` and header-newline guards still apply.
- [ ] `KERGHAN_EMAIL_METHOD` is in `.env.dev.sample`, `.env`, and `environment-variables.md`;
      the stale Django-style email block in `.env` is renamed to `KERGHAN_EMAIL_*`.
- [ ] `docs/agents/modules/mail.md` API + Send-methods sections reflect the new surface.
- [ ] `docker-compose run --rm kerghan_tests yarn coverage` and
      `docker-compose run --rm kerghan_tests yarn lint` pass.

## Benefits

- A single seam for *how* mail leaves the system: a future provider is a self-contained
  `EmailMethod` added to the registry, with no change to `MailService` or its callers.
- The choice is per-environment (`KERGHAN_EMAIL_METHOD`) or per-call, and a typo fails fast
  rather than silently mis-routing or dropping mail.
- Lands the `sendEmail` shape #70's `sendEmailTemplate` (sub-issue 2) delegates into, so that
  work builds on a settled internal contract.
- Consistent with existing conventions — `KERGHAN_*` namespace, read-once-at-boot config factory,
  `mail.tokens.ts` DI tokens, `new`-with-fakes specs.
