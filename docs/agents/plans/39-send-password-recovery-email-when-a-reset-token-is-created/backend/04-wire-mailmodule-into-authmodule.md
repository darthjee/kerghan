# Wire `MailModule` into `AuthModule`

Register the listener as a provider and give it access to `MailService`.

## What to do

Edit `backend/src/auth/auth.module.ts`:

1. Add `MailModule` to the `imports` array (import from `../mail/mail.module.js`). This is the
   one-way edge `AuthModule → MailModule`; `MailModule` exports `MailService`, so direct DI into
   the listener works with no further wiring.
2. Add `PasswordRecoveryRequestedListener` to the `providers` array (import from
   `./events/password-recovery-requested.listener.js`). It does not need to be exported — it is
   an internal reactor, not consumed by other modules.
3. Keep `import/order` alphabetized: `MailModule`'s import line sorts under the other
   `../`-relative... actually `../mail/mail.module.js` is a parent import — group it with the
   existing `./`-relative imports and let `alphabetize` place it. `PasswordRecoveryRequestedListener`
   sorts among the `./...` imports.

## Verify (no code change, but part of this step)

- `docker-compose run --rm kerghan_tests yarn test` — the full suite. Pay attention to
  `auth/tests/auth.controller.e2e-spec.ts`: it imports `AuthModule`, so it now instantiates
  `MailModule` too. It must stay green — the test env leaves `KERGHAN_EMAILS_ENABLED` unset, so
  `MailModule`'s factory builds the disabled config and a `null` transporter without throwing,
  and the new listener resolves `{ status: 'skipped' }` for every `recover` call in that spec.
- If `app.module.spec.ts` exists and asserts the module graph, confirm it still passes (adding a
  provider to `AuthModule` and an already-imported module to its imports should not disturb it).

## Files to Change

- `backend/src/auth/auth.module.ts` — add `MailModule` to `imports`, add
  `PasswordRecoveryRequestedListener` to `providers`.
