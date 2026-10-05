# Add a user-token revocation method to TokenService
Add a public method to `TokenService`:

```ts
revokeUserTokens(userId: number, keepRefreshToken?: string): Promise<void>
```

It sets `revokedAt: new Date()` on every row matching `{ userId, revokedAt: IsNull() }`. When
`keepRefreshToken` is given, it also adds `tokenHash: Not(this.hashToken(keepRefreshToken))` to
the criteria, so the presented token survives only if it is one of this user's unrevoked rows.
A foreign or unknown token matches none of the user's rows, so everything is revoked (fail
safe). A revoked token is already revoked. An expired-but-unrevoked kept row is harmless
because `refresh()` already rejects it as expired. Document this in the method's doc-comment.

Optionally, have `AuthService#revokeTokenFamily` delegate to
`this.tokenService.revokeUserTokens(userId)`, so the two "revoke a user's tokens" paths cannot
drift. This also shrinks `auth.service.ts`. Keep its behavior identical; the existing
`auth.service.spec.ts` expectations on the repository `update` call may need adjusting.

Jest (`tests/token.service.spec.ts`):
- Without a keep token, it updates `{ userId, revokedAt: IsNull() }`.
- With a keep token, the criteria also exclude that token's hash.

## Files to Change
- `backend/src/auth/token.service.ts` — new `revokeUserTokens` method (import `IsNull`, `Not`).
- `backend/src/auth/auth.service.ts` — (optional) `#revokeTokenFamily` delegates to it.
- `backend/src/auth/tests/token.service.spec.ts` — specs for the new method.
- `backend/src/auth/tests/auth.service.spec.ts` — adjust only if the optional delegation is done.
