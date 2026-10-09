# Prune expired/used password-reset tokens on mint
In `PasswordResetService#issueToken` (shared by self-service recover and the admin recovery-link/email flows), delete the user's reset-token rows that are expired or already used, before saving the new one. TypeORM's `Repository#delete` does not accept an OR'd array of where objects, so run two deletes:
- `delete({ userId: user.id, expiresAt: LessThan(now) })`
- `delete({ userId: user.id, usedAt: Not(IsNull()) })`

Active (unused, unexpired) tokens stay valid. Update the JSDoc.

Specs: the user's expired and used rows are removed; the user's still-active row and other users' rows are kept; the newly minted token works for `reset-password`.

## Files to Change
- `backend/src/auth/password-reset.service.ts` — add both prune deletes in `issueToken`; import `LessThan`/`Not`/`IsNull`; update the JSDoc.
- `backend/src/auth/tests/password-reset.service.spec.ts` — add the pruning cases. Relies on the in-memory `delete`/`lessThan` support from step 02.
