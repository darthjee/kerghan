# SessionController, DTO and e2e specs
New thin `SessionController`, modeled on `AuthorizationRequestController`. It is authenticated through the default `JwtGuard` (no `@Public()`), and the caller comes from `@CurrentUser()`:

```ts
@Controller('auth')
@CachePolicy(CacheClass.Never)
export class SessionController {
  @Post('sessions/mine.json')            // body: { refreshToken } → { sessions: ActiveSession[] }
  @Post('sessions/:uuid/revoke.json')    // body: { refreshToken } → { revoked: true }
  @Post('sessions/revoke-others.json')   // body: { refreshToken } → { revoked: true }
}
```

- Body DTO: reuse `RefreshTokenDto` (`refreshToken`, a non-empty string). Update its doc-comment to list the new routes, or add a `CurrentSessionDto` with the same shape if the name would mislead. `revoke.json` accepts the body for consistency but ignores it.
- Each handler only delegates to `SessionService` and wraps the result. No logic lives in the controller.
- Register the controller in `AuthModule.controllers`.
- Route order: declare `sessions/mine.json` and `sessions/revoke-others.json` before `sessions/:uuid/revoke.json`. The paths differ in shape so they don't actually clash, but keep the order explicit anyway.

E2e spec `session.controller.e2e-spec.ts` (reuse `auth.controller.e2e-test-support.ts` helpers: `useTestApp`, `loginAs`, `registerUser`):
- unauthenticated calls → 401;
- after two logins, `mine.json` lists two sessions and marks the one matching the body's token as current; after a refresh, the session keeps its `id` and `startedAt`;
- `:uuid/revoke.json` for an own session → 201, and that session's refresh token stops working; another user's uuid → 404, and that session still works; an unknown uuid → 404;
- `revoke-others.json` → only the current session survives (its refresh still works, the others' fail); an invalid token → 401, and every session survives;
- each route sends `x-skip-cache: true` and `cache-control: no-store`.

## Files to Change
- `backend/src/auth/session.controller.ts`: new controller.
- `backend/src/auth/dto/refresh-token.dto.ts`: doc-comment (or a new `current-session.dto.ts`).
- `backend/src/auth/auth.module.ts`: register `SessionController`.
- `backend/src/auth/tests/session.controller.e2e-spec.ts`: new e2e spec.
