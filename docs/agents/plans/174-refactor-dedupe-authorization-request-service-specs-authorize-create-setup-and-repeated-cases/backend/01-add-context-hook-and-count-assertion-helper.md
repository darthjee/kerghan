# Add the context hook and count-assertion helper
In `authorization-request.service.test-support.ts`:

1. Add `useAuthorizationRequestServiceContext(): AuthorizationRequestServiceTestContext`. It keeps a private `let context` variable, registers `beforeEach(() => { context = createAuthorizationRequestServiceTestContext(); })`, and returns an object whose properties (`authorizationRequestRepository`, `userRepository`, `tokenService`, `eventEmitter`, `configService`, `service`) are getters reading from `context`. Keep `createAuthorizationRequestServiceTestContext()` exported (the hook builds on it). Give it a JSDoc block like the surrounding helpers (the ESLint config includes `eslint-plugin-jsdoc`).
2. Add `expectBothCreateCountsComputed(repo, ip, username)`: asserts `repo.count` was called with `expect.objectContaining({ where: expect.objectContaining({ requestIp: ip }) })` and again with `{ username }` — the exact assertion pair currently duplicated in `authorization-request.service.create.spec.ts` ("always computes both the IP and username counts (never short-circuiting)") and `authorization-request-abuse-guard.service.spec.ts` ("always computes both counts, never short-circuiting on the first"). Type the `repo` parameter loosely (e.g. `{ count: jest.Mock }`) so both specs' repository mocks fit.

## Files to Change
- `backend/src/auth/tests/authorization-request.service.test-support.ts` — add the hook and the assertion helper, with JSDoc.
