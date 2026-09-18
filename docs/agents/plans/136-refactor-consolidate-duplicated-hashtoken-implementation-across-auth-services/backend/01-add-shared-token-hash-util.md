# Add shared token-hash utility
Create a new plain-function utility module in `backend/src/core/`, matching the existing convention for shared, dependency-free helpers in that folder (e.g. `getNumberConfig` in `numeric-config.ts`). Export a single `hashToken(token: string): string` that returns the SHA-256 hex digest of `token`, moving the exact `createHash('sha256').update(token).digest('hex')` expression currently duplicated across the three auth services.

## Files to Change
- `backend/src/core/token-hash.ts` — new file. Import `createHash` from `node:crypto`; export `hashToken(token: string): string` returning `createHash('sha256').update(token).digest('hex')`. Include a short JSDoc describing it as the single source of truth for token hashing across the backend.
