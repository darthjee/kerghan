# Add shared request helpers
Create `backend/src/auth/tests/support/auth-requests.ts` exporting:

- `loginAs(app, username = 'darthjee', password = 'my-password'): Promise<request.Response>` — `POST /auth/login.json`, returns the full supertest response (no `.expect`, so failing-login specs can still assert their own status).
- `loginCookie(app, username?, password?): Promise<string>` — built on `loginAs`, returns `response.headers['set-cookie'][0].split(';')[0]` (the `access_token=...` cookie for `.set('Cookie', [cookie])`).
- `registerUser(app, { username, email, password = 'my-password' }): Promise<request.Response>` — `POST /auth/register.json`, returns the response.

Then make the existing `login(app, username, password)` in `authorization-request.controller.e2e-test-support.ts` delegate to `loginCookie` (keeping its exported name so its callers stay untouched), so the two support files share one implementation. Re-export `loginAs`, `loginCookie` and `registerUser` from `auth.controller.e2e-test-support.ts` so specs keep a single import.

## Files to Change
- `backend/src/auth/tests/support/auth-requests.ts` — new: `loginAs`, `loginCookie`, `registerUser`.
- `backend/src/auth/tests/authorization-request.controller.e2e-test-support.ts` — `login()` delegates to `loginCookie`.
- `backend/src/auth/tests/auth.controller.e2e-test-support.ts` — re-export the new helpers.
