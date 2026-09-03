# Add `email` to the recovery-requested event

The listener (step 03) sends to the user's address without a DB lookup, so the address has to
travel in the event payload. `PasswordResetService#recover` already has the `user` row in hand
at the emit point, so this is a zero-cost append.

## What to do

1. **`PasswordRecoveryRequestedEvent`** — add a fourth `readonly email: string` field, appended
   after `resetUrl` (no positional reshuffle). Add the constructor parameter and its assignment,
   and a `@param {string} email - ...` JSDoc line (position it after the `resetUrl` `@param` so
   `jsdoc/check-param-names`, an error-level rule, stays satisfied). Rewrite the class-level
   docstring: it currently says *"No listener consumes it yet — out of scope for this issue (see
   #39) — it only needs to fire with the right payload."* Replace that with a description of the
   in-module consumer — `password-recovery-requested.listener.ts` (added in step 03) — which
   builds and sends the recovery email through `MailService`. Keep the note that the plaintext
   `token` exists only in-flight and is never persisted.

2. **`PasswordResetService#recover`** — pass `user.email` as the fourth argument to
   `new PasswordRecoveryRequestedEvent(user.id, token, resetUrl, user.email)`. No other change to
   the method: same `Promise<void>` return, same early-return when `user` is falsy, same token
   creation and `emit` call.

3. **`password-reset.service.spec.ts`** — the existing test *"emits a password-recovery.requested
   event with the reset URL"* asserts the emitted payload with `expect.objectContaining({...})`.
   Add `email: 'darthjee@example.com'` to that matcher (the `user` fixture in the spec already
   has `email: 'darthjee@example.com'`). No new test needed here — the listener's own behavior is
   covered in step 03.

## Files to Change

- `backend/src/auth/events/password-recovery-requested.event.ts` — add the `email` field,
  constructor param, assignment, and `@param`; rewrite the class docstring to reference the new
  listener.
- `backend/src/auth/password-reset.service.ts` — pass `user.email` as the 4th constructor
  argument at the `emit` call in `recover`.
- `backend/src/auth/tests/password-reset.service.spec.ts` — extend the emit-assertion matcher
  with `email: 'darthjee@example.com'`.
