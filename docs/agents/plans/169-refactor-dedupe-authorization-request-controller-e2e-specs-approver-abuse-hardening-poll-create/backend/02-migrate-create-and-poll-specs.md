# Migrate the create and poll specs
Replace the `let app` / `beforeEach` / `afterEach` scaffold with `const ctx = useTestApp()` in both specs (using `ctx.app` / `ctx.authorizationRequestRepo`). In `create`, replace the two identical `toEqual({ uuid, pollToken, expiresAt })` blocks (lines 20-30 ↔ 33-43) with `expectUniformCreateResponse(response.body)`. Drop now-unused imports (`INestApplication`, `buildTestApp`, `createInMemoryRepo`, `AuthorizationRequest`) so lint stays clean. Test names, order and count are unchanged.

## Files to Change
- `backend/src/auth/tests/authorization-request.controller.create.e2e-spec.ts` — use `useTestApp()` and `expectUniformCreateResponse`.
- `backend/src/auth/tests/authorization-request.controller.poll.e2e-spec.ts` — use `useTestApp()`; `approve()` helper reads `ctx.authorizationRequestRepo`.
