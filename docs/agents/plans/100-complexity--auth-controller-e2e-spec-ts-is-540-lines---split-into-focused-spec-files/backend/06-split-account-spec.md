# Split off the account spec

Create `backend/src/auth/tests/auth.controller.account.e2e-spec.ts` containing the
`PATCH /auth/account.json` describe block from the current
`auth.controller.e2e-spec.ts` (rejects an unauthenticated request, updates the
username and responds with `{ username, email }`, sets `X-Skip-Cache`, rejects the
wrong current password without changing the account, does not revoke the caller's
other refresh tokens on a successful password change, and its nested login-helper
`it()`).

The new file declares its own top-level `describe('AuthController (e2e)', () => {
... })` with `beforeEach`/`afterEach` calling `buildTestApp()`/`app.close()` from the
support file created in Step 1, moving the describe block unchanged, including its
local `login()` helper that extracts the access-token cookie.

## Files to Change

- `backend/src/auth/tests/auth.controller.account.e2e-spec.ts` — new file, moved
  from the `PATCH /auth/account.json` block of `auth.controller.e2e-spec.ts`.
