# Add the shared helpers
Add four exported helpers to the existing support module so the specs can drop their duplicated blocks. Keep the module's existing style (top-of-function `//` comments, `supertest` `request(app.getHttpServer())`).

- `useTestApp()` — registers `beforeEach` (calls `buildTestApp()` and stores `{ app, userRepo, authorizationRequestRepo }`) and `afterEach` (`await app.close()`), and returns a context object with getters `app`, `userRepo` and `authorizationRequestRepo` that always reflect the current test's instance. Must be called inside a `describe`.
- `postMine(app, cookie)` — `POST /auth/authorization-requests/mine.json` with `.set('Cookie', [cookie]).send({}).expect(201)`, returning the supertest response.
- `expectUniformCreateResponse(body)` — `expect(body).toEqual({ uuid: expect.any(String), pollToken: expect.any(String), expiresAt: expect.any(String) })`.
- `fillCreateLimit(app, { username: (i) => string, ip?: (i) => string, count?: number })` — issues `count` (default 5) `POST /auth/authorization-requests.json` calls, each `.expect(201)`, sending `username(i)` and, when `ip` is given, `.set('X-Forwarded-For', ip(i))`. Covers both the per-IP loop (`username: (i) => `rate-ip-${i}``, no `ip`) and the per-username loop (`username: () => name`, `ip: (i) => `203.0.113.${i}``).

## Files to Change
- `backend/src/auth/tests/authorization-request.controller.e2e-test-support.ts` — add `useTestApp`, `postMine`, `expectUniformCreateResponse`, `fillCreateLimit` (import `beforeEach`/`afterEach` are Jest globals, no import needed).
