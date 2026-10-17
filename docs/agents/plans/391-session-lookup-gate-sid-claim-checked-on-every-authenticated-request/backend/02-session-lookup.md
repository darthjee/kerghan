# Session lookup abstraction and auth implementation
Give `JwtGuard` a way to load the active session's user without `core/` importing `auth/`.

- New `backend/src/core/session-lookup.ts`: an injection token `SESSION_LOOKUP` and an
  interface `SessionLookup { findActiveSessionUser(sid: string): Promise<SessionUser | null> }`,
  where `SessionUser = { id: number; username: string; isAdmin: boolean }` (a core-owned shape,
  so core needs no `User` entity import). JSDoc explains why it exists (dependency inversion
  for the core/auth boundary) and that the implementation must only return a user for an
  **active** (not revoked, not expired) session.
- `SessionService` (`backend/src/auth/session.service.ts`, already the owner of session reads)
  implements it with **one** query joining the user, e.g. a `User` repository query builder
  `innerJoin(RefreshToken, 'session', 'session.user_id = user.id')` with
  `session.session_uuid = :sid`, `session.revoked_at IS NULL`, `session.expires_at > :now`,
  returning the user's `id`, `username`, `isAdmin` (or `null`). Because the join is on
  `user_id`, the returned `id` is the row's `userId`. Inject the `User` repository if it is not
  there yet.
- `AuthModule` adds `{ provide: SESSION_LOOKUP, useExisting: SessionService }` and exports
  `SESSION_LOOKUP` (alongside `AuthService`). `AppModule` already imports `AuthModule`, so the
  global `JwtGuard` resolves it.
- `session.service.spec.ts`: the query builder is called with the expected conditions and
  parameters, maps the result, and returns `null` when nothing matches.

## Files to Change
- `backend/src/core/session-lookup.ts` — new token + interface + `SessionUser` type.
- `backend/src/auth/session.service.ts` — implement `findActiveSessionUser`.
- `backend/src/auth/auth.module.ts` — provide/export `SESSION_LOOKUP`; update module JSDoc.
- `backend/src/auth/tests/session.service.spec.ts` — unit tests for the lookup.
