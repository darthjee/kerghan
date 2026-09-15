# Split off the `poll` spec file

Create `backend/src/auth/tests/authorization-request.service.poll.spec.ts`, moving the `describe('poll', ...)` block (current lines 331–486) into it, wrapped in the same outer `describe('AuthorizationRequestService', () => { ... })`. Import the shared test context from `authorization-request.service.test-support.ts` (Step 1) and use its `sha256()` for building `pollTokenHash` fixtures, same as today.

## Files to Change
- `backend/src/auth/tests/authorization-request.service.poll.spec.ts` — new file; contains only the `poll` scenarios (unknown uuid / wrong token / open-not-expired / open-past-expiry / denied / logged / approved with atomic claim win/loss), importing scaffolding from `authorization-request.service.test-support.ts`.
