# Issue: Send password-recovery email when a reset token is created

Part of #36 (password recovery flow). #36 creates a `PasswordResetToken` row and fires the
`password-recovery.requested` event (`PasswordRecoveryRequestedEvent`, mirroring the existing
`UserRegisteredEvent` pattern) when a recovery is requested for a known email — but #36 ships no
listener and sends no email. #38 (outbound email infrastructure) has since landed a
general-purpose `MailService`. This issue adds the listener that composes and sends the recovery
email through it.

## Description

### Scope

- An `@OnEvent('password-recovery.requested')` listener on `PasswordRecoveryRequestedEvent`, in
  the Auth module.
- A pure content builder (`buildPasswordRecoveryEmail`) producing the subject + plain-text body;
  the body embeds the `resetUrl` from the event
  (`${FRONTEND_BASE_URL}/#/recover-password?token=<token>`, already composed by #36) — the token
  is the full opaque value in the URL, not a short code the user types in.
- Appending `email` to `PasswordRecoveryRequestedEvent` and its emit site in
  `PasswordResetService#recover`.
- Wiring `MailModule` into `AuthModule`.
- The event & docs cleanup listed under Solution.

### Touches code shipped in #36

#36 and #38 are both merged to `main`. #39 modifies two files that shipped in #36 —
`backend/src/auth/events/password-recovery-requested.event.ts` (new `email` field) and
`backend/src/auth/password-reset.service.ts` (pass `user.email` at the emit site) — plus their
specs. Expected, not a merge hazard; see the Backward compatibility subsection.

### Depends on

- #38 (mail infrastructure) for the send mechanism — **merged**.
- #36 (password recovery flow) for the token entity and the event it fires — **merged**.

### Out of scope

- The recover/reset-password endpoints themselves — see #36.
- Admin-triggered "force send" of this same email — see the separate admin-tool issue.
- An HTML email body — deferred to a follow-up.
- Endpoint rate-limiting / recovery-request dedup — #36's concern.
- i18n / localisation — English only.

## Problem

- #36 fires `password-recovery.requested` but nothing consumes it, so a user who requests a
  password reset never receives a link — the flow is a dead end end-to-end.
- The event payload (`{ userId, token, resetUrl }`) carries no email address, so a listener
  cannot address a message without either a payload change or a DB lookup.
- `MailService` (from #38) is unused; #39 is its first consumer and has to establish where a
  feature-specific listener and its copy live relative to the generic mail pipe.

## Expected Behavior

### Recovery email

- **Subject:** `Reset your Kerghan password`
- **Body (plain text only):**

  ```
  Hi,

  We received a request to reset the password for your Kerghan account.

  Open this link to choose a new password:
  <resetUrl>

  This link can only be used once, and it expires a short time after it was
  requested. If it has already expired, request a new one from the sign-in page.

  If you didn't ask to reset your password, you can safely ignore this email —
  your password won't change.
  ```

- `from` is omitted → `MailService` defaults to `KERGHAN_EMAIL_FROM`.
- Expiry wording is generic — no hardcoded duration, since
  `KERGHAN_PASSWORD_RESET_TOKEN_TTL_MS` is configurable (default 30 min). A concrete "expires in
  N minutes" would require carrying `expiresAt` (or the TTL) in the event payload; deferred.

### Fire-and-forget / failure isolation

- `recover()` emits synchronously (`eventEmitter.emit`, not `emitAsync`); the listener runs
  inline only up to its first `await` (trivial string building + `send()`'s synchronous guards),
  then the controller responds and the SMTP send completes detached. The HTTP response is never
  blocked by the send or by the up-to-10 s `KERGHAN_EMAIL_TIMEOUT_MS`.
- The listener wraps its whole body in `try/catch` and always resolves — it never relies on
  `@nestjs/event-emitter`'s `suppressErrors`. A send failure never propagates to the
  already-responded request.
- When email is disabled (`KERGHAN_EMAILS_ENABLED !== 'true'`), `send()` resolves
  `{ status: 'skipped' }`; the listener treats that as a normal outcome (no warning).

### Logging

- Success: one `debug` line — `messageId` + `userId`.
- Caught failure: one `warn` line — `userId` + the error message.
- Never logged by the listener: the email address, token, `resetUrl`, subject, or body.
  `MailService` separately logs `error` with recipient + subject per its #38 contract.

### Edge cases

| Case | Behavior |
|---|---|
| Mail disabled | `send()` → `skipped`; listener logs nothing (`MailService` emits its own `debug`) |
| SMTP unreachable / connection refused / timeout (≤ `KERGHAN_EMAIL_TIMEOUT_MS`) | `send()` rejects → listener `warn`; no retry |
| SMTP auth rejected (535) at send time | `send()` rejects → listener `warn`; no retry |
| Recipient refused (550) / `info.rejected` non-empty | `MailService` throws `mail: recipient rejected: <addr>` → listener `warn`. The address is in `err.message` for this case only, matching #38's error-log contract |
| User row deleted between `emit` and listener execution | Listener still sends (payload carries `email`, no re-query); the window is near-nil. Dead link if the token row was also removed. Benign |
| `email` empty / contains `\r\n` | Cannot occur — `auth_users.email` is `NOT NULL` and `@IsEmail`-validated at registration; `MailService`'s guards would reject anyway |
| `FRONTEND_BASE_URL` unset → `resetUrl` is `"undefined/#/recover-password?token=…"` | Email sends with a broken link. Out of scope — a #36 / env-config problem; the listener does not validate `resetUrl` |
| Rapid repeat recovery requests | One event and one email each; multiple valid tokens coexist. No dedup — rate-limiting is #36's concern |
| `send()` returns `sent` with `messageId` undefined | `debug` logs `messageId=undefined`; harmless |

## Solution

### Listener placement

The `@OnEvent('password-recovery.requested')` handler lives in the **Auth module**, at
`backend/src/auth/events/password-recovery-requested.listener.ts` — next to the
`password-recovery-requested.event.ts` payload class it already owns. `AuthModule` imports
`MailModule` and injects `MailService`; the dependency edge is one-way
(`AuthModule → MailModule`, Mail imports nothing back).

- `events/` in `docs/agents/architecture/modular-pattern.md` is defined as holding both
  `@OnEvent` handlers and event payload classes — this is its textbook use.
- Auth owns the event, the `PasswordResetToken`, and the whole recovery feature.
- The Mail module stays a general-purpose pipe. Per #38 / `docs/agents/modules/mail.md` it ships
  no templating and "message content is entirely the caller's responsibility" — putting
  feature-specific copy or a feature-specific subscription in `mail/` was explicitly out of
  scope for that module, and would force `mail/` to import `auth/` (infra depending on a
  feature).
- The listener is still decoupled from the producer: `PasswordResetService` fires and forgets.

Rejected: a dedicated `notifications/` (or `transactional-email/`) module consuming
`user.registered`, `password-recovery.requested`, etc. and composing all transactional copy —
premature for a single listener. **Future extraction point:** when `user.registered` gets its
welcome email (a second transactional listener), pull both into a `notifications/` module then.

### Recipient resolution

Append `email` to `PasswordRecoveryRequestedEvent` — `new PasswordRecoveryRequestedEvent(user.id,
token, resetUrl, user.email)` — in `PasswordResetService#recover`, which already has the `user`
row loaded at the emit point; update the event's JSDoc.

- Zero extra cost: the row is already in hand; no DB round-trip, no new `AuthService` method.
- Matches precedent — `UserRegisteredEvent` already carries `{ userId, username, email }`.
- Self-contained payload: the listener has no DB dependency and unit-tests against a plain
  object.
- The event only fires when the user exists (`recover()` returns early otherwise), so `email` is
  always a real, known address — no "send to unknown recipient" path.

The listener consumes `email` (as `to`) and `resetUrl` only; `userId` and `token` stay in the
payload for other potential consumers (`resetUrl` already embeds the token).

Rejected: resolving `userId → email` via `AuthService` in the listener (new public API surface,
an extra query per request, a user-deleted-mid-flight race); querying the `User` repo directly
from the listener (a redundant read of a row `recover()` already loaded).

### Email content builder

Mail ships no templating, so the listener composes the message via a pure builder, following the
codebase's pure-helper pattern (`buildJwtSignOptions`, `buildMailConfig`):

`backend/src/auth/events/password-recovery-email.content.ts` →
`buildPasswordRecoveryEmail(resetUrl: string): { subject: string; text: string }`

The listener stays thin: read event → call the builder → `mailService.send({ to, ...built })` →
catch. Text-only — `html` is omitted (deferred). The builder returns a plain object testable
without an HTML parser.

### Config toggle

No recovery-specific env flag — rely solely on the global `KERGHAN_EMAILS_ENABLED` (owned by
#38's Mail module). Recovery email is currently the only `MailService` consumer. #36's
"independently disable-able by config" is already satisfied: with mail disabled, `recover()`
still creates the token, still fires the event, and still returns `200`; `send()` resolves
`{ status: 'skipped' }`; the listener treats that as normal. A per-feature flag would require a
boot-time config factory/provider in `AuthModule` (none today) to honour product.md's "no hidden
env reads inside classes" — real infrastructure for a speculative need.

**Future option:** if a real need to suppress only the recovery email arises (e.g. an incident
where reset links are leaking), add `KERGHAN_PASSWORD_RECOVERY_EMAIL_ENABLED` then, resolved
once via a new `AuthModule` config factory and injected into the listener.

### Event & docs cleanup

- **`backend/src/auth/events/password-recovery-requested.event.ts`** — rewrite the class
  docstring (currently "No listener consumes it yet — out of scope for this issue (see #39)");
  describe the in-module listener that consumes it and sends the recovery email via
  `MailService`. Add the `email` field to the class field list and the `@param` JSDoc.
- **`docs/agents/modules/auth.md`** — add a `## password-recovery.requested event` section (the
  doc currently documents only `user.registered`, a pre-existing gap from #36): fired by
  `PasswordResetService#recover` for a known email; payload `{ userId, token, resetUrl, email }`;
  consumed by the in-module listener, which builds the copy via
  `password-recovery-email.content.ts` and sends through `MailService` (Mail module, direct DI);
  best-effort — a send failure is logged at `warn` and never propagated. Note that `AuthModule`
  now imports `MailModule`.
- **`docs/agents/modules/mail.md`** — fix the broken issue link
  (`39-send-the-password-recovery-email.md` →
  `39-send-password-recovery-email-when-a-reset-token-is-created.md`) and reword "First consumer"
  so it points at `auth/events/password-recovery-requested.listener.ts` and makes clear the
  listener lives in the **Auth** module, not `mail/`.
- **`docs/agents/summary.md`** — extend the Auth line "the `user.registered` event" to "the
  `user.registered` and `password-recovery.requested` events".
- No change needed: `docs/agents/architecture/backend.md` (its `src/` tree shows `auth/events/`
  as a folder only, no file list) and `docs/agents/folder-structure.md` (module-level pointers
  only).

### Testing strategy

Plain unit tests that `new` the class with fakes — no `Test.createTestingModule` for this kind
of collaborator; specs under `tests/`.

1. **`backend/src/auth/tests/password-recovery-email.content.spec.ts`** —
   `buildPasswordRecoveryEmail(resetUrl)`: `subject` is exactly `Reset your Kerghan password`;
   `text` contains the passed `resetUrl` verbatim, on its own line; `text` contains the
   single-use / expiry sentence and the "didn't request this" sentence; no `html` key in the
   result.
2. **`backend/src/auth/tests/password-recovery-requested.listener.spec.ts`** —
   `new PasswordRecoveryRequestedListener(fakeMailService)`, `fakeMailService.send` a mock:
   - happy path: `send` called once with `{ to: <event.email>, subject, text }` (no `from`, no
     `html`); resolves; one `debug` line with `messageId` + `userId`
   - `send` resolves `{ status: 'skipped' }` → no throw, no `warn`
   - `send` rejects → listener resolves (does **not** throw), one `warn` with `userId`; assert
     the log call args contain neither the token, `resetUrl`, nor the body text
   - `send` rejects with a recipient-rejected error → still swallowed, `warn` logged
3. **`backend/src/auth/tests/password-reset.service.spec.ts`** (existing) — update the emit
   assertion to expect the 4th arg: `PasswordRecoveryRequestedEvent` now carries `user.email`.
4. No e2e / real SMTP. `auth.controller.e2e-spec.ts` (imports `AppModule`) stays green as long
   as the test env does not set `KERGHAN_EMAILS_ENABLED=true` — confirm during implementation.

### Backward compatibility

- **Event constructor gains a 4th parameter**, appended — no positional reshuffle. The only
  caller is `PasswordResetService#recover`, updated in the same change. No serialized/persisted
  form of the event exists (in-process `EventEmitter2`), so no data or wire-format migration.
- **`PasswordResetService#recover` behaviour is unchanged** from the caller's view — same
  return type (`Promise<void>`), same early-return-on-unknown-email, same token creation.
- **New `AuthModule` → `MailModule` import.** `MailModule` is always-on and boot-safe by default
  (`KERGHAN_EMAILS_ENABLED` defaults to `false` → no transporter, factory never throws, per
  #38). `AppModule` already imports both, so no new module enters the graph.
- **No API / route / DTO / entity / migration change.** Route docs, `navi/` cache-warmer
  configs, and the proxy are untouched; no `X-Skip-Cache` concern.
- **No new dependency** — `nodemailer` landed with #38.

### Security & performance

- **No new enumeration surface.** The listener runs after the response is sent and only fires
  for known users — zero observable timing difference. The "a real user receives an email" side
  channel is inherent to password reset and part of #36's accepted design.
- **No user-controlled data in the message.** Only `resetUrl` (server-built) is interpolated —
  no "Hi {username}". No header-injection vector: `to` is `@IsEmail`-validated `user.email`,
  `subject` is a static constant, `from` is `KERGHAN_EMAIL_FROM`; `MailService` also has a
  `\r\n` guard.
- **Token handling unchanged** — single-use (`usedAt`), short TTL (default 30 min), SHA-256 at
  rest.
- **PII discipline.** `email` is added to the in-process event only — never
  serialized/persisted/logged; nothing may log the whole payload. The listener logs `userId` +
  error message only.
- **Inherent email-channel risks** (cleartext past the SMTP hop, forwarded/shared inboxes) are
  documented, not mitigated here — bounded by TTL + single-use; further hardening is a #36
  frontend concern.
- **Performance** — zero added request latency; no new DB work; one shared non-pooled nodemailer
  transporter (#38); one email per request; a single listener on the event.

## Benefits

- Completes the password recovery flow end-to-end — a user who requests a reset now actually
  receives a working link.
- Establishes `MailService` as consumable by feature modules without polluting the generic mail
  pipe with feature-specific content — the pattern the welcome-email listener and any future
  transactional email will follow.
- The self-contained event payload (with `email`) keeps the listener DB-free and trivially
  testable.
- Best-effort, failure-isolated delivery: email problems never break the `/auth/recover.json`
  endpoint.
