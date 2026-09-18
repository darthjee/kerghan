# Delegate TokenService.hashToken to the shared util
Update `TokenService.hashToken` to call the new shared `hashToken` from `src/core/token-hash.ts` instead of computing the digest inline. Keep the method public with its current signature and its existing JSDoc (the one documenting why it's exposed for `AuthService`'s refresh-token read paths) — only the method body changes, so `AuthService`'s three `this.tokenService.hashToken(refreshToken)` call sites and `auth.service.spec.ts`'s mock of `tokenService.hashToken` are unaffected.

## Files to Change
- `backend/src/auth/token.service.ts` — import `hashToken` from `../core/token-hash.js`, remove the now-unused `createHash` import (unless still used elsewhere in the file — check first), and change the `hashToken` method body to `return hashToken(token);`.
