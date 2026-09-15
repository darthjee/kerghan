# Split off the `authorize` spec file

Create `backend/src/auth/tests/authorization-request.service.authorize.spec.ts`, moving the `describe('authorize', ...)` block (current lines 540–723) into it, wrapped in the same outer `describe('AuthorizationRequestService', () => { ... })`. Import the shared test context from `authorization-request.service.test-support.ts` (Step 1). This block additionally uses `bcrypt.hashSync(...)` directly (line 541), so add `import bcrypt from 'bcryptjs';` to this file (not part of the shared helper, since no other split file needs it).

## Files to Change
- `backend/src/auth/tests/authorization-request.service.authorize.spec.ts` — new file; contains only the `authorize` scenarios (correct password / missing row / wrong owner / not-open / expired / wrong password / cool-off lockout), importing scaffolding from `authorization-request.service.test-support.ts` plus its own `bcryptjs` import.
