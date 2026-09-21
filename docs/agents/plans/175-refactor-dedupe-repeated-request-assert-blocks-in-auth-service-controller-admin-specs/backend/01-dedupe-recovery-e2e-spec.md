# Dedupe recovery e2e spec
In `auth.controller.recovery.e2e-spec.ts`, two pairs issue the same request twice, once for the body and once for `x-skip-cache`:

- `recover flow`: `responds 200 { sent: true } for an email that matches an account` ↔ `sets the X-Skip-Cache header` (both `POST /auth/recover.json` with `darthjee@example.com`). Wrap both in a `describe('for an email that matches an account')` whose `beforeEach` sends the request and stores the response. Leave `does not match any account` and `creates a password-reset token only when…` where they are (different requests).
- `reset-password flow`: `resets the password and responds 200 { reset: true }` ↔ `sets the X-Skip-Cache header` (both call `requestRecoveryToken` then `POST /auth/reset-password.json`). Wrap them in a `describe('with a valid token')` whose `beforeEach` obtains the token, posts the reset, and stores the response. Assertions become separate `it`s: body is `{ reset: true }`; the new password can log in (`loginAs(ctx.app, 'darthjee', 'brand-new-password').expect(201)`); `x-skip-cache` is `'true'`.

Leave the other reset-password tests (revokes refresh tokens, unknown/used/expired token, too-short password) untouched — each exercises a distinct request or state.

## Files to Change
- `backend/src/auth/tests/auth.controller.recovery.e2e-spec.ts` — group the two pairs under shared-`beforeEach` describes, keeping every assertion in its own `it`.
