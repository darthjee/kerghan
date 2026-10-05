# Mint and carry the session on login and rotation
Make `TokenService#issueTokens` accept an optional existing session:

```ts
interface SessionIdentity { sessionUuid: string; startedAt: Date }
issueTokens(user: User, keepSignedIn = false, session?: SessionIdentity): Promise<AuthResult>
```

- With no `session` (login, device-auth poll, register), mint a fresh one with `randomUUID()` (`node:crypto`), with `startedAt` = now.
- With a `session`, copy `sessionUuid` and `startedAt` onto the new row.
- `AuthService#refresh` passes `{ sessionUuid: tokenRow.sessionUuid, startedAt: tokenRow.startedAt }` next to `tokenRow.keepSignedIn`. Update both doc-comments: like `keepSignedIn`, the session identity carries over on rotation.
- The callers that start a new session (`login`, `register`, `AuthorizationRequestService#poll`) stay unchanged.

Specs:
- `token.service.spec.ts`: a new UUID and `startedAt` are minted when no session is given; the given session is copied when passed.
- `auth.service.spec.ts`: `refresh` passes the presented row's session identity to `issueTokens`.
- The existing e2e refresh test asserts that the rotated row keeps `session_uuid`/`started_at`, if the e2e support exposes the repository. Otherwise the unit specs cover it.

## Files to Change
- `backend/src/auth/token.service.ts`: the `session` parameter and fresh-session minting.
- `backend/src/auth/auth.service.ts`: `refresh` carries the session over.
- `backend/src/auth/tests/token.service.spec.ts`: new cases.
- `backend/src/auth/tests/auth.service.spec.ts`: the refresh carry-over case.
