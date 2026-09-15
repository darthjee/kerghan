# Extract shared test scaffolding into a helper

Create `backend/src/auth/tests/authorization-request.service.test-support.ts`, moving out of the top of `authorization-request.service.spec.ts` (lines 1–54 and the `beforeEach` scaffolding at lines 56–84) everything the 5 new per-method spec files will need to share:

- The `RepoMock<T>` type.
- `queryBuilderMock()`.
- `repoMock<T>()`.
- `sha256()`.
- A new exported factory, e.g. `createAuthorizationRequestServiceTestContext()`, that builds `authorizationRequestRepository`, `userRepository`, `tokenService`, `eventEmitter`, `configService`, constructs `AuthorizationRequestAbuseGuardService` and `AuthorizationRequestService` exactly as today's `beforeEach` does (lines 64–84), and returns all of them so each spec file's own `beforeEach` can call it and destructure what it needs.

Keep the exact same mock behavior (default return values, `jest.fn()` wiring) — this is a lift-and-move, not a rewrite.

## Files to Change
- `backend/src/auth/tests/authorization-request.service.test-support.ts` — new file; houses the extracted `RepoMock`, `repoMock()`, `queryBuilderMock()`, `sha256()`, and the new `createAuthorizationRequestServiceTestContext()` factory, with the same imports (`node:crypto`, `@nestjs/config`, `@nestjs/event-emitter`, `AuthorizationRequestAbuseGuardService`, `AuthorizationRequestService`, `AuthorizationRequest`, `User`, `TokenService`) currently at the top of `authorization-request.service.spec.ts`.
