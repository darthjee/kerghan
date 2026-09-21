# Convert the five service specs to the hook
In each of the five spec files, replace the block of `let` declarations and the destructuring `beforeEach` with `const ctx = useAuthorizationRequestServiceContext();` (inside the top-level `describe`), and rewrite every use of the removed bare names to `ctx.<name>` (`ctx.service`, `ctx.userRepository`, `ctx.authorizationRequestRepository`, `ctx.tokenService`, `ctx.eventEmitter`, `ctx.configService`). Drop imports that become unused (`RepoMock`, `AuthorizationRequestService`, `AuthorizationRequest`, `User` where they were only used for the `let` types; keep `User` where it is still used for casts such as `as User`) and import `useAuthorizationRequestServiceContext` instead of `createAuthorizationRequestServiceTestContext`.

Pure mechanical rewrite: no assertion, test name or `describe` structure changes in this step. Take care with local helper functions defined inside describes (e.g. `mockConfig` in `create`'s "rate limiting") — they must reference `ctx.configService` lazily inside the function body.

Run the backend tests after converting each file to keep failures easy to localise.

## Files to Change
- `backend/src/auth/tests/authorization-request.service.authorize.spec.ts` — use the hook (needs `authorizationRequestRepository`, `userRepository`, `eventEmitter`, `configService`, `service`).
- `backend/src/auth/tests/authorization-request.service.create.spec.ts` — use the hook (same members).
- `backend/src/auth/tests/authorization-request.service.deny.spec.ts` — use the hook (`authorizationRequestRepository`, `eventEmitter`, `service`).
- `backend/src/auth/tests/authorization-request.service.listOpenForUser.spec.ts` — use the hook (`authorizationRequestRepository`, `service`).
- `backend/src/auth/tests/authorization-request.service.poll.spec.ts` — use the hook (`authorizationRequestRepository`, `userRepository`, `tokenService`, `eventEmitter`, `service`).
