# Documentation updates

Bring the docs in line with the new listener. (Documentation scope — folded into this
`backend` plan because `architect` is the excluded coordinator; see `backend.md` Notes.)

## What to do

### `docs/agents/modules/auth.md`

Add a new section documenting the event, alongside the existing `## user.registered event`
section (the doc currently documents only `user.registered` — `password-recovery.requested` was
never documented when #36 shipped it):

```
## password-recovery.requested event

`PasswordResetService#recover` fires `password-recovery.requested` (via `EventEmitter2`) with a
`PasswordRecoveryRequestedEvent { userId, token, resetUrl, email }` payload whenever a recovery
is requested for a known email — see `events/password-recovery-requested.event.ts`. It is
consumed in-module by `events/password-recovery-requested.listener.ts`, which builds the
plain-text message with `events/password-recovery-email.content.ts` and sends it through
`MailService` (Mail module, direct DI — `AuthModule` imports `MailModule`). Delivery is
best-effort: the listener swallows every send error (one `warn` line, `userId` only) and treats
a disabled-mail `{ status: 'skipped' }` as success, so a mail problem never affects the
already-responded `/auth/recover.json` request.
```

(Match the surrounding prose style / line width of `auth.md`.)

### `docs/agents/modules/mail.md`

In the opening paragraph, the "First consumer" sentence currently reads:

> First consumer: [#39](../issues/39-send-the-password-recovery-email.md), the password-recovery
> email, wired as an `@OnEvent('password-recovery.requested')` listener.

- Fix the broken link target: `39-send-the-password-recovery-email.md` →
  `39-send-password-recovery-email-when-a-reset-token-is-created.md`.
- Reword so it is clear the listener lives in the **Auth** module, not `mail/` — e.g.: "First
  consumer: the password-recovery email (see
  [#39](../issues/39-send-password-recovery-email-when-a-reset-token-is-created.md)), an
  `@OnEvent('password-recovery.requested')` listener in the **Auth** module
  (`backend/src/auth/events/password-recovery-requested.listener.ts`) that calls
  `MailService.send`."

### `docs/agents/summary.md`

The Auth line reads:

> - **[Auth](modules/auth.md)** — Kerghan's always-on login module: `/auth/*.json` routes, the
>   `auth_` tables, the JWT/refresh-token flow, and the `user.registered` event.

Change the tail to: "… and the `user.registered` and `password-recovery.requested` events."

## Files to Change

- `docs/agents/modules/auth.md` — add the `## password-recovery.requested event` section.
- `docs/agents/modules/mail.md` — fix the broken issue link and reword the "First consumer"
  sentence to place the listener in the Auth module.
- `docs/agents/summary.md` — extend the Auth events mention.
