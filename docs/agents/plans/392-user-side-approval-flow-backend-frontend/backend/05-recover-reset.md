# Recover and reset

**Recover** (`PasswordResetService#recover`): a `denied` user is treated like an unknown email:
return before `issueToken`, no event, same log line class as "user not found" (no status in the
response). Response stays `200 { sent: true }` for every status.

**Reset** (`PasswordResetService#resetPassword`): after `#findActiveToken`, load the user; a
`denied` user → `BadRequestException('Invalid or expired token')` (the same message as
`#findActiveToken`), password unchanged, token **not** marked used. Keep the existing
`assertNotDefaultUser` order (default user is never denied). `pending` resets and stays `pending`.

Admin `recovery-link.json` / `send-recovery-email.json` stay unchanged (they call `issueToken`
directly).

Tests (api.md): recover returns the same body for each status and creates no token / emits no
event for denied; reset with a denied user's token → `400`, password unchanged, `usedAt` still
null; pending can reset and stays pending.

## Files to Change
- `backend/src/auth/password-reset.service.ts` — denied branches.
- `backend/src/auth/tests/password-reset.service.spec.ts`, `auth.controller.recovery.e2e-spec.ts` — coverage.
