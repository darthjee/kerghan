# Split off the `create` spec file

Create `backend/src/auth/tests/authorization-request.service.create.spec.ts`, moving the `describe('create', ...)` block (current lines 86–330 of `authorization-request.service.spec.ts`) into it, wrapped in the same outer `describe('AuthorizationRequestService', () => { ... })`. Import the shared test context from the new helper (Step 1) instead of redeclaring mocks locally, and use its returned `service`/`userRepository`/`authorizationRequestRepository`/`eventEmitter`/`configService` in place of the current module-level `let` bindings.

## Files to Change
- `backend/src/auth/tests/authorization-request.service.create.spec.ts` — new file; contains only the `create` scenarios (username matches an account / does not match / TTL derivation / rate limiting / concurrent-open cap), importing scaffolding from `authorization-request.service.test-support.ts`.
