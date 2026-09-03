# Documentation updates

Backend-domain docs. Keep each edit minimal and consistent with the surrounding style.

## `docs/agents/environment-variables.md` (§1 "Backend application runtime")

Replace the two reserved rows — `EMAILS_ENABLED` and the combined
`EMAIL_HOST / EMAIL_PORT / EMAIL_HOST_USER / EMAIL_HOST_PASSWORD / EMAIL_USE_TLS /
DEFAULT_FROM_EMAIL` row — with 8 rows:

| Variable | Status | Purpose | Source |
|---|---|---|---|
| `KERGHAN_EMAILS_ENABLED` | **Consumed**, optional | Master toggle; `'true'` enables outbound sending, anything else (default) disables it (log-and-skip). | `backend/src/mail/mail.config.ts`, `backend/src/mail/mail.module.ts` |
| `KERGHAN_EMAIL_HOST` | **Consumed** (required when enabled) | SMTP host. Boot throws if enabled without it. | `backend/src/mail/mail.config.ts` |
| `KERGHAN_EMAIL_PORT` | **Consumed**, optional | SMTP port; defaults to `587`. `465` ⇒ implicit TLS (`secure`); other ports ⇒ STARTTLS when `KERGHAN_EMAIL_USE_TLS`. | `backend/src/mail/mail.config.ts` |
| `KERGHAN_EMAIL_USER` | **Consumed**, optional | SMTP auth username. `auth` is sent only when both user and password are set. | `backend/src/mail/mail.config.ts` |
| `KERGHAN_EMAIL_PASSWORD` | **Consumed**, optional | SMTP auth password. | `backend/src/mail/mail.config.ts` |
| `KERGHAN_EMAIL_USE_TLS` | **Consumed**, optional | Forces a STARTTLS upgrade on non-465 ports. Defaults to `true`. | `backend/src/mail/mail.config.ts` |
| `KERGHAN_EMAIL_FROM` | **Consumed** (required when enabled) | Default `From:` address. Must be one the SMTP server is authorized to send as (SPF/DKIM). | `backend/src/mail/mail.config.ts` |
| `KERGHAN_EMAIL_TIMEOUT_MS` | **Consumed**, optional | Bounds nodemailer's connection/greeting/socket timeouts. Defaults to `10000`. | `backend/src/mail/mail.config.ts` |

Leave the `FRONTEND_BASE_URL` row unchanged (still "Reserved, not yet read" — it stays that way
until #39 wires the recovery link).

## `.env.dev.sample`

Already done in Step 02 — no further change; just verify it matches the doc table above.

## `docs/agents/folder-structure.md`

- In the top-level `backend/` row (the one reading "only the Auth module exists — …"), broaden
  it: "the Auth and Mail modules exist — …".
- In the "`backend/` — Backend" table, add a row after `src/auth/`:
  `| \`src/mail/\` | Mail module — always-on, no routes/entities — see \`docs/agents/modules/mail.md\` |`

## `docs/agents/architecture/backend.md`

Add `mail/` to the `src/` tree diagram, next to `auth/`, with a one-line comment
("Mail module — always-on, general-purpose transactional email sender, no HTTP surface").

## `docs/agents/architecture/modular-pattern.md`

In the "Module classification" table, the **Always-on** row's Examples cell currently reads
"Auth module — imported directly into `AppModule`". Add ", Mail module".

## `docs/agents/modules/mail.md` (new)

Mirror the shape of `docs/agents/modules/auth.md`, trimmed (no routes, no entities):

- `# Module — Mail`
- Intro: Kerghan's general-purpose transactional-email sender; always-on (imported directly into
  `AppModule`); no HTTP surface; consumed by other modules / event listeners via exported
  `MailService`. First consumer: #39 (password-recovery email).
- **Configuration**: the `KERGHAN_EMAIL_*` env vars (link to `environment-variables.md`), read
  once at boot by `mail.config.ts`'s `buildMailConfig`; three boot states (disabled / enabled /
  enabled-but-misconfigured → boot throws).
- **API**: the `send(params) → Promise<SendMailResult>` contract; `{ status: 'skipped' }` when
  disabled (never throws); rejects on a configured send failure (caller decides whether to
  swallow).
- **No templates**: message content is the caller's responsibility.
- **Logging**: boot mode line at `log`; per-call skip at `debug`; send failure at `error`; never
  logs message bodies or credentials.

## `docs/agents/summary.md`

Add a one-line abstract for `modules/mail.md`, matching the format of the existing
`modules/auth.md` entry.

## Files to Change

- `docs/agents/environment-variables.md`
- `docs/agents/folder-structure.md`
- `docs/agents/architecture/backend.md`
- `docs/agents/architecture/modular-pattern.md`
- `docs/agents/modules/mail.md` — new
- `docs/agents/summary.md`
