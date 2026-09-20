# Add options to auth buildTestApp
Change `buildTestApp()` in `auth.controller.e2e-test-support.ts` to accept an optional options object, e.g. `buildTestApp({ adminGuard = false, registerDefaultUser = true } = {})`:

- `adminGuard: true` — add `{ provide: APP_GUARD, useClass: AdminGuard }` after the `JwtGuard` provider (guard order matters: `JwtGuard` must run first so `AdminGuard` sees the authenticated user).
- `registerDefaultUser: false` — skip the up-front `POST /auth/register.json` for `darthjee`.

Defaults must preserve current behavior so no other spec changes. Update the header comment on `buildTestApp` to describe the options. The return shape already includes `userRepo`, which the admin spec needs.

## Files to Change
- `backend/src/auth/tests/auth.controller.e2e-test-support.ts` — options parameter, conditional `AdminGuard` provider, conditional default-user registration, `AdminGuard` import.
