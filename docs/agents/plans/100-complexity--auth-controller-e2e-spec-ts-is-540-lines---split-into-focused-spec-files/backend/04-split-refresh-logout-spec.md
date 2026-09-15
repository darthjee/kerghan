# Split off the refresh/logout/status spec

Create `backend/src/auth/tests/auth.controller.refresh-logout.e2e-spec.ts`
containing the `refresh token rotation` describe block (issues a new token pair and
invalidates the old refresh token, rejects an expired refresh token), the `logout`
describe block (invalidates the refresh token and clears the access-token cookie),
and the `status check` describe block (`loggedIn: true`/`false` cases, `isAdmin: true`
for an admin's active token, does not set/clear the access-token cookie, reachable
without a cookie since it's `@Public()`, sets `X-Skip-Cache`) from the current
`auth.controller.e2e-spec.ts` — all three revolve around the refresh-token lifecycle
(`POST /auth/refresh.json`, `POST /auth/logout.json`, the status endpoint).

The new file declares its own top-level `describe('AuthController (e2e)', () => {
... })` with `beforeEach`/`afterEach` calling `buildTestApp()`/`app.close()` from the
support file created in Step 1, moving all three describe blocks unchanged.

## Files to Change

- `backend/src/auth/tests/auth.controller.refresh-logout.e2e-spec.ts` — new file,
  moved from the `refresh token rotation`, `logout`, and `status check` blocks of
  `auth.controller.e2e-spec.ts`.
