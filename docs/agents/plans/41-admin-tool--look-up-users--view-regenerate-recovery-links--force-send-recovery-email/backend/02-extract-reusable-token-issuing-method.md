# Extract a reusable token-issuing method

`PasswordResetService#recover()` currently inlines token creation (generate random bytes, hash,
save the `PasswordResetToken` row, build the `resetUrl`) directly in its body before emitting
`password-recovery.requested`. The new admin flows (step 03) need that exact same
generate-hash-save-build-URL logic, but for an admin-chosen `User` row instead of one looked up by
email, and without emitting the self-service event.

Extract the token-creation logic (everything between generating `token` and building `resetUrl`,
inclusive) into a new **public** method on `PasswordResetService`, e.g. `issueToken(user: User):
Promise<{ token: string; resetUrl: string }>`. `recover()` becomes: look up the user by email,
return early if not found, otherwise call `this.issueToken(user)` and emit the event with the
result. Behavior of `recover()` must not change — same TTL config key
(`KERGHAN_PASSWORD_RESET_TOKEN_TTL_MS`), same hashing, same `resetUrl` format.

## Files to Change

- `backend/src/auth/password-reset.service.ts` — extract `issueToken(user)`, reuse it from
  `recover()`.
- `backend/src/auth/tests/password-reset.service.spec.ts` — add direct coverage for `issueToken`,
  keep existing `recover()` coverage passing unchanged.
