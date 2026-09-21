# Apply helpers to the auth specs
For each of `login`, `guard`, `skip-cache`, `recovery`, `account` and `refresh-logout`:

- Replace the `let app`/`let <repo>` declarations plus the `beforeEach`/`afterEach` block with `const ctx = useTestApp();` (or destructure nothing and read `ctx.app`, `ctx.userRepo`, ... inside tests). Drop imports that become unused (`INestApplication`, `createInMemoryRepo`, entity types, `buildTestApp`).
- Replace every inline `request(app.getHttpServer()).post('/auth/login.json').send({ username: 'darthjee', password: 'my-password' })` with `loginAs(ctx.app)`; keep `.expect(201)` at call sites that had it (e.g. `login`, `skip-cache`) by asserting `response.status`, or add an optional expected-status argument if that reads better — the asserted behavior must not change.
- `login` spec: the invalid-password case uses `loginAs(ctx.app, 'darthjee', 'wrong-password')` and still expects 401.
- `guard` spec and `account` spec: replace the inline `set-cookie[0].split(';')[0]` extraction and the local `loginCookie()` helper (`account`) with the shared `loginCookie(ctx.app)`.
- `skip-cache` spec: keep it as a dedicated file documenting the `X-Skip-Cache` contract; use `loginAs` for the login/refresh/logout setup and `registerUser(ctx.app, { username: 'obi-wan', email: 'obi-wan@example.com', password: 'another-password' })` for the register case.
- `recovery` spec: use `loginAs` for both the post-reset login (expects 201 with the new password) and the "revokes other refresh tokens" setup; `passwordResetTokenRepo` is read via `ctx.passwordResetTokenRepo`.
- `refresh-logout` spec: use `loginAs` for all seven login calls; `userRepo`/`refreshTokenRepo` via `ctx`.

## Files to Change
- `backend/src/auth/tests/auth.controller.login.e2e-spec.ts`
- `backend/src/auth/tests/auth.controller.guard.e2e-spec.ts`
- `backend/src/auth/tests/auth.controller.skip-cache.e2e-spec.ts`
- `backend/src/auth/tests/auth.controller.recovery.e2e-spec.ts`
- `backend/src/auth/tests/auth.controller.account.e2e-spec.ts`
- `backend/src/auth/tests/auth.controller.refresh-logout.e2e-spec.ts`
