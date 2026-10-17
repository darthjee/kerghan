# Add the sid claim
Sign a `sid` claim into every access token and type it.

- `AccessTokenPayload` gains `sid: string`; update its JSDoc (shape signed by
  `TokenService#issueTokens`, now `{ sub, sid, username, isAdmin }`; `request.user` is built by
  `JwtGuard` from the DB, not the raw payload). `express.d.ts` picks it up through the same type.
- `TokenService#issueTokens` resolves `const sessionUuid = session?.sessionUuid ?? randomUUID()`
  once, signs `{ sub, sid: sessionUuid, username, isAdmin }`, and saves the same `sessionUuid` on
  the refresh-token row. Update its JSDoc.
- `token.service.spec.ts`: the signed token carries `sid` equal to the saved row's
  `sessionUuid`, for a new session and on rotation (same `sid` as the carried session).

## Files to Change
- `backend/src/core/access-token-payload.ts` — add `sid`, update JSDoc.
- `backend/src/auth/token.service.ts` — sign `sid`, single `sessionUuid` source.
- `backend/src/auth/tests/token.service.spec.ts` — `sid` assertions.
