# Prune expired refresh tokens on mint
In `TokenService#issueTokens`, delete the minting user's expired refresh-token rows on every mint (login, register, device authorization, rotation): `refreshTokenRepository.delete({ userId: user.id, expiresAt: LessThan(new Date()) })`. Run it before saving the new row. Use a strict `LessThan`, matching `findActiveRefreshToken`'s `expiresAt < now` rejection. Revoked but unexpired rows must survive, because replay detection needs them. Other users' rows are never touched. Document the pruning and why it is safe for replay detection in the method and class JSDoc.

Extend the in-memory test repository: add a `delete(criteria)` that removes the matching rows and returns `{ affected }`, and support the `lessThan` operator in `matchesCondition`, updating its header comment.

Specs:
- Unit (`token.service.spec.ts`): `issueTokens` calls `delete` with `{ userId, expiresAt: LessThan(...) }`.
- e2e (`auth.controller.refresh-logout.e2e-spec.ts` or `auth.controller.login.e2e-spec.ts`):
  - An expired row of the user is gone after login/refresh.
  - A revoked but unexpired row of the user is kept.
  - Another user's expired row is kept.
  - A rotated token that is replayed before it expires still triggers replay detection (`replay_detected` on the user's tokens).

## Files to Change
- `backend/src/auth/token.service.ts` — add the prune `delete` in `issueTokens`; import `LessThan`; update the JSDoc.
- `backend/src/auth/tests/support/in-memory-repo.ts` — add `delete` and the `lessThan` operator.
- `backend/src/auth/tests/token.service.spec.ts` — add a `delete` mock and an expectation.
- `backend/src/auth/tests/auth.controller.refresh-logout.e2e-spec.ts` — add the pruning/replay e2e cases.
