# Block password recovery and reset

Inject `DefaultUserService` into `PasswordResetService`.

- `recover(dto)`: after the user lookup, if `isDefaultUser(user.id)`, log at info level (without revealing anything to the client) and `return` exactly like the unknown-email branch. No token, no event, no email. The controller's `200 { sent: true }` is unchanged.
- `resetPassword(dto)`: after `#findActiveToken` (existing `400` errors first), call `assertNotDefaultUser(tokenRow.userId)` **before** hashing or any write. The password is unchanged, the token is not marked used, and `AuthService.resetPassword` never reaches `revokeUserTokens`.
- Leave `issueToken` unguarded. The admin call sites already block in step 02, and `recover` must stay silent rather than throw.
- Update `password-reset.service.spec.ts`: the default user's recover creates no token and emits no event; reset with a valid default-user token throws `409` with the documented body, leaves the password and token untouched; invalid/expired tokens keep `400`; other users and the disabled feature are unchanged.
- Check that the frontend reset-password page surfaces a `409` `error.message` (spec asks #369 to confirm this). Report the result; don't change the frontend.

## Files to Change
- `backend/src/auth/password-reset.service.ts` — inject `DefaultUserService`; silent skip in `recover`, block in `resetPassword`.
- `backend/src/auth/tests/password-reset.service.spec.ts` — new cases; adjust constructor.
