# Add auth useTestApp helper
In `auth.controller.e2e-test-support.ts`, add `useTestApp(options?: { adminGuard?: boolean; registerDefaultUser?: boolean })`, modelled on the one in `authorization-request.controller.e2e-test-support.ts`: called synchronously inside a `describe` body, it registers `beforeEach` (`current = await buildTestApp(options)`) and `afterEach` (`await current.app.close()`), and returns an object with getters `app`, `userRepo`, `refreshTokenRepo` and `passwordResetTokenRepo` reading from `current` (getters are required because the instances are reassigned before every test).

Type the context as `Awaited<ReturnType<typeof buildTestApp>>`, as the authorization-request helper does. Keep `buildTestApp` exported and unchanged (still used by `useTestApp`).

## Files to Change
- `backend/src/auth/tests/auth.controller.e2e-test-support.ts` — add `useTestApp`.
