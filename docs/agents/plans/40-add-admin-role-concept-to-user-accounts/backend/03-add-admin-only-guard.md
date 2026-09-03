# Add `@AdminOnly()` decorator and global `AdminGuard`

The authorization primitive, mirroring `@Public()` / `JwtGuard`.

- New file `backend/src/core/admin-only.decorator.ts`, same shape as `public.decorator.ts`:
  `export const IS_ADMIN_ONLY_KEY = 'isAdminOnly';`
  `export const AdminOnly = (): ReturnType<typeof SetMetadata> => SetMetadata(IS_ADMIN_ONLY_KEY, true);`
  with a doc-comment: marks a route or controller as requiring an admin account; enforced by the
  global `AdminGuard`, which runs after `JwtGuard`.
- New file `backend/src/core/admin.guard.ts`: `@Injectable()` class `AdminGuard implements
  CanActivate`, constructor-injecting `Reflector` (same DI style as `JwtGuard` — explicit
  private fields assigned in the constructor).
  - `canActivate`: if `@AdminOnly()` metadata is absent (via
    `reflector.getAllAndOverride<boolean>(IS_ADMIN_ONLY_KEY, [getHandler(), getClass()])`),
    return `true` (no-op).
  - Otherwise read `request.user` (typed `AccessTokenPayload | undefined`); throw
    `ForbiddenException` when it is missing or `user.isAdmin !== true`; return `true` when
    `user.isAdmin === true`.
  - Do not re-verify the JWT — `JwtGuard` already did.
- `backend/src/app.module.ts`: add
  `{ provide: APP_GUARD, useClass: AdminGuard }` to the `providers` array **immediately after**
  the existing `JwtGuard` `APP_GUARD` entry (registration order = execution order for
  `APP_GUARD`s).
- New unit spec `backend/src/core/tests/admin.guard.spec.ts` (establishes the pattern that
  `jwt.guard.ts` currently lacks a spec for):
  - Fake `Reflector` + a fake `ExecutionContext` (`switchToHttp().getRequest()` returning a
    plain `{ user }` object, plus `getHandler`/`getClass`).
  - Cases: no `@AdminOnly()` metadata → returns `true` regardless of `user`;
    `@AdminOnly()` + `user.isAdmin === true` → returns `true`;
    `@AdminOnly()` + `user.isAdmin === false` → throws `ForbiddenException`;
    `@AdminOnly()` + `user` undefined → throws `ForbiddenException`.

## Files to Change

- `backend/src/core/admin-only.decorator.ts` — new `@AdminOnly()` decorator + metadata key.
- `backend/src/core/admin.guard.ts` — new global `AdminGuard`.
- `backend/src/app.module.ts` — register `AdminGuard` as an `APP_GUARD` after `JwtGuard`.
- `backend/src/core/tests/admin.guard.spec.ts` — new unit spec for `AdminGuard`.
