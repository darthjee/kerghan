# Split off the `listOpenForUser` spec file

Create `backend/src/auth/tests/authorization-request.service.listOpenForUser.spec.ts`, moving the `describe('listOpenForUser', ...)` block (current lines 487–539) into it, wrapped in the same outer `describe('AuthorizationRequestService', () => { ... })`. Import the shared test context from `authorization-request.service.test-support.ts` (Step 1).

## Files to Change
- `backend/src/auth/tests/authorization-request.service.listOpenForUser.spec.ts` — new file; contains only the `listOpenForUser` scenarios (queries only open/non-expired rows for the given user, maps to the public shape with no leaked fields, returns an empty array when nothing matches), importing scaffolding from `authorization-request.service.test-support.ts`.
