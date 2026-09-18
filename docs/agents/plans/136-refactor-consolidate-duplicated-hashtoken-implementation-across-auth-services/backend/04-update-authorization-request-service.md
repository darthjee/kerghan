# Update AuthorizationRequestService
Remove the private `#hashToken` method entirely and replace its two call sites with the shared `hashToken` from `src/core/token-hash.ts`, since nothing outside the class calls the private method today.

## Files to Change
- `backend/src/auth/authorization-request.service.ts` — import `hashToken` from `../core/token-hash.js`, remove the now-unused `createHash` import, delete the private `#hashToken(token: string): string` method, and change the two call sites (`this.#hashToken(pollToken)` in the create path and in `poll`) to call `hashToken(pollToken)` directly.
