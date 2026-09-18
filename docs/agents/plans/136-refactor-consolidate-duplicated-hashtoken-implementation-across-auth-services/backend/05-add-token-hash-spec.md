# Add unit tests for the shared util
Add a dedicated spec for the new shared utility, and verify the three affected services' existing specs still pass unchanged (no assertions of theirs should need edits, since output stays byte-identical and `TokenService.hashToken` keeps its public signature).

## Files to Change
- `backend/src/core/tests/token-hash.spec.ts` — new file. Test that `hashToken('abc')` returns the known SHA-256 hex digest (reuse the expected value already asserted in `backend/src/auth/tests/token.service.spec.ts`'s `hashToken` describe block), and that it's stable/matches a freshly computed `createHash('sha256').update(value).digest('hex')` for an arbitrary value.
- `backend/src/auth/tests/token.service.spec.ts`, `backend/src/auth/tests/password-reset.service.spec.ts`, `backend/src/auth/tests/authorization-request.service.*.spec.ts` — no changes expected; run the full backend suite after steps 1-4 to confirm.
