# SessionService: list, revoke one, revoke others
New `SessionService` in the Auth module. It holds all the business logic for the endpoints and depends on `Repository<RefreshToken>` and `TokenService` (for `hashToken`/`revokeUserTokens`). Register it in `AuthModule.providers`; it is not exported.

```ts
interface ActiveSession {
  id: string;            // sessionUuid
  startedAt: Date;
  lastUsedAt: Date;      // the active row's issuedAt (the latest login/rotation)
  keepSignedIn: boolean;
  current: boolean;
}
```

- `listActive(userId: number, refreshToken: string): Promise<ActiveSession[]>`: finds the rows matching `{ userId, revokedAt: IsNull(), expiresAt: MoreThan(new Date()) }`, newest `issuedAt` first, and maps each one. `current` is `row.tokenHash === tokenService.hashToken(refreshToken)`. An unknown or invalid token marks nothing as current and never throws.
- `revoke(userId: number, sessionUuid: string): Promise<void>`: `update({ userId, sessionUuid, revokedAt: IsNull() }, { revokedAt: new Date() })`. When `affected === 0` (unknown uuid, another user's session, or one already revoked), it throws `NotFoundException`, so a foreign session is indistinguishable from a missing one. Revoking the current session is allowed. Expired-but-unrevoked rows are harmless either way: refresh already rejects them, and the list hides them.
- `revokeOthers(userId: number, refreshToken: string): Promise<void>`: looks up the row by `tokenHash`. When there is no row, the row is revoked, the row is expired, or `row.userId !== userId`, it throws `UnauthorizedException` and revokes nothing. Otherwise it calls `tokenService.revokeUserTokens(userId, refreshToken)`.

Specs (`session.service.spec.ts`, mocked repositories as in `repo-mock.test-support.ts`):
- the list returns only the caller's active rows (the query criteria are asserted), mapped correctly, with the current one marked; nothing is marked current for an unknown token;
- `revoke` updates with the user-scoped criteria; `affected: 0` → 404 (covers another user's uuid);
- `revokeOthers`: a valid own token calls `revokeUserTokens(userId, token)`; an unknown, revoked, expired or foreign token → 401, and `revokeUserTokens`/`update` are never called.

## Files to Change
- `backend/src/auth/session.service.ts`: new service.
- `backend/src/auth/auth.module.ts`: register `SessionService`.
- `backend/src/auth/tests/session.service.spec.ts`: new spec.
