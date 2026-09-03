# Recovery-email content builder

A pure function that turns a reset URL into the email's subject and plain-text body. Kept
separate from the listener (step 03) so it is unit-testable on its own, mirroring the codebase's
`buildJwtSignOptions` / `buildMailConfig` pure-helper pattern.

## What to do

Create `backend/src/auth/events/password-recovery-email.content.ts` exporting:

```ts
export function buildPasswordRecoveryEmail(resetUrl: string): { subject: string; text: string }
```

- **`subject`**: the literal string `Reset your Kerghan password`.
- **`text`**: the plain-text body from the issue's Expected Behavior section, verbatim, with
  `resetUrl` on its own line:

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

- No `html` key — text-only for this issue.
- Full JSDoc (`@param`, `@returns` with descriptions — `jsdoc/require-*-description` is a warning
  but the codebase writes them everywhere).
- Consider defining the subject and the body prefix/suffix as module-level `const`s so the
  interpolation of `resetUrl` is the only dynamic part; keep the file well under the 300-line
  limit (it will be ~40 lines).

### Spec — `backend/src/auth/tests/password-recovery-email.content.spec.ts`

Plain unit tests calling `buildPasswordRecoveryEmail('https://app.example/#/recover-password?token=abc123')`:

- `subject` is exactly `Reset your Kerghan password`.
- `text` contains the passed URL verbatim, on a line by itself (e.g. assert
  `text.split('\n')` includes the URL string).
- `text` contains the single-use / expiry sentence (`can only be used once`) and the
  "didn't ask to reset" sentence.
- the result has no `html` key (`expect(result).not.toHaveProperty('html')`).

## Files to Change

- `backend/src/auth/events/password-recovery-email.content.ts` — **new**; the pure builder.
- `backend/src/auth/tests/password-recovery-email.content.spec.ts` — **new**; unit tests for it.
