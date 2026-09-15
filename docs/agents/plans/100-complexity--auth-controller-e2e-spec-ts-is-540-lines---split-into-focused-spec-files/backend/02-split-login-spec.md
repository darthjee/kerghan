# Split off the login spec

Create `backend/src/auth/tests/auth.controller.login.e2e-spec.ts` containing the
`login flow` describe block (logs in with valid credentials, rejects an invalid
password, sets the access-token cookie as httpOnly/secure/SameSite=Strict) and the
`access-token cookie maxAge` describe block (defaults to 900 seconds when
`KERGHAN_ACCESS_TOKEN_TTL_MS` is unset) from the current
`auth.controller.e2e-spec.ts` — both scoped to `POST /auth/login.json`.

The new file declares its own top-level `describe('AuthController (e2e)', () => {
... })` with `beforeEach`/`afterEach` calling `buildTestApp()`/`app.close()` from the
support file created in Step 1, moving both describe blocks unchanged (same
assertions, same request payloads) inside it.

## Files to Change

- `backend/src/auth/tests/auth.controller.login.e2e-spec.ts` — new file, moved from
  the `login flow` and `access-token cookie maxAge` blocks of
  `auth.controller.e2e-spec.ts`.
