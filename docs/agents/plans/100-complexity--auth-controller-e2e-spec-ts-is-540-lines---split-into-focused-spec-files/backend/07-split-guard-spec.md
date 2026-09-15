# Split off the JwtGuard spec

Create `backend/src/auth/tests/auth.controller.guard.e2e-spec.ts` containing the
`JwtGuard` describe block from the current `auth.controller.e2e-spec.ts` (allows a
public route through without a token, rejects a protected route with no access
token, rejects a protected route with an invalid access token, allows a protected
route with a valid access token). This exercises the global `JwtGuard` via the
`ProtectedTestController`/`PublicTestController` fixtures from the support file
created in Step 1, not an `AuthController` route itself — keep it in its own file
since it's a different subject under test than the rest of the module.

The new file declares its own top-level `describe('AuthController (e2e)', () => {
... })` with `beforeEach`/`afterEach` calling `buildTestApp()`/`app.close()` from the
support file, moving the describe block unchanged.

## Files to Change

- `backend/src/auth/tests/auth.controller.guard.e2e-spec.ts` — new file, moved from
  the `JwtGuard` block of `auth.controller.e2e-spec.ts`.
