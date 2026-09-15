# Split off the create scenario

Create `backend/src/auth/tests/authorization-request.controller.create.e2e-spec.ts`, covering only the original `describe('create', ...)` block (lines 242–278 of the original file: matching-username shape, non-matching-username shape, and the `X-Skip-Cache` header on create).

Structure:

```ts
import { matchesCondition, createInMemoryRepo, buildTestApp } from './authorization-request.controller.e2e-test-support.js';
// + whatever of INestApplication / request / AuthorizationRequest / User this file itself needs

describe('AuthorizationRequestController (e2e)', () => {
  let app: INestApplication;

  beforeEach(async () => {
    ({ app } = await buildTestApp());
  });

  afterEach(async () => {
    await app.close();
  });

  describe('create', () => {
    // the three `it(...)` blocks, unchanged
  });
});
```

This scenario does not use the `createAuthorizationRequest`/`approve` helpers (per `backend.md`'s Notes), so neither needs to be redeclared here — only `app` is needed from `buildTestApp()`'s return value.

## Files to Change

- `backend/src/auth/tests/authorization-request.controller.create.e2e-spec.ts` — new file; the `create` describe block, moved verbatim.
