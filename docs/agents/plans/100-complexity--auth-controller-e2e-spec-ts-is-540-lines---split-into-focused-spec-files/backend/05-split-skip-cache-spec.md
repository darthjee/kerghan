# Split off the skip-cache spec

Create `backend/src/auth/tests/auth.controller.skip-cache.e2e-spec.ts` containing
the standalone `X-Skip-Cache header` describe block from the current
`auth.controller.e2e-spec.ts` (asserts the header is set on the login, register,
refresh, and logout responses). This block is kept as its own file rather than folded
into the login/refresh files, since it is a single cross-cutting contract asserted
across four different endpoints, not scoped to one of them.

The new file declares its own top-level `describe('AuthController (e2e)', () => {
... })` with `beforeEach`/`afterEach` calling `buildTestApp()`/`app.close()` from the
support file created in Step 1, moving the describe block unchanged.

## Files to Change

- `backend/src/auth/tests/auth.controller.skip-cache.e2e-spec.ts` — new file, moved
  from the `X-Skip-Cache header` block of `auth.controller.e2e-spec.ts`.
