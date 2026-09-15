# Split off the recovery spec

Create `backend/src/auth/tests/auth.controller.recovery.e2e-spec.ts` containing the
`recover flow` describe block (200 `{ sent: true }` for a matching email, 200 for a
non-matching email, sets `X-Skip-Cache`, creates a password-reset token only when the
email matches an account) and the `reset-password flow` describe block (resets the
password and responds `{ reset: true }`, sets `X-Skip-Cache`, revokes the user's other
refresh tokens on success, rejects an unknown token with 400, rejects an already-used
token, rejects an expired token, rejects a too-short password without touching the
token) from the current `auth.controller.e2e-spec.ts` — covering
`POST /auth/recover.json` and `POST /auth/reset-password.json`.

The new file declares its own top-level `describe('AuthController (e2e)', () => {
... })` with `beforeEach`/`afterEach` calling `buildTestApp()`/`app.close()` from the
support file created in Step 1, moving both describe blocks unchanged.

## Files to Change

- `backend/src/auth/tests/auth.controller.recovery.e2e-spec.ts` — new file, moved
  from the `recover flow` and `reset-password flow` blocks of
  `auth.controller.e2e-spec.ts`.
