# Split off the approver routes scenario

Create `backend/src/auth/tests/authorization-request.controller.approver.e2e-spec.ts`, covering the original `describe('approver routes', ...)` block (lines 380–587 of the original file), which itself nests:

- `mine` — auth-required, own-only, never leaks another user's or an unresolved-username request.
- `authorize` — auth-required, wrong password, cross-user rejection, correct-password success (credential grant exactly once).
- `deny` — auth-required, cross-user rejection, owner-call success.
- `X-Skip-Cache header` — set on the `mine`, `authorize`, and `deny` responses.

Keep the outer `approver routes` describe and its own setup (the shared login helper that extracts the session cookie, currently at lines 386/715-style local usage) — check the original file for whatever local `beforeEach`/login helper is scoped to this describe and carry it over unchanged.

This scenario uses `createAuthorizationRequest` only (per `backend.md`'s Notes) — redeclare it locally; `approve` is not needed here.

```ts
import { matchesCondition, createInMemoryRepo, buildTestApp } from './authorization-request.controller.e2e-test-support.js';

describe('AuthorizationRequestController (e2e)', () => {
  let app: INestApplication;
  let authorizationRequestRepo: ReturnType<typeof createInMemoryRepo<AuthorizationRequest>>;

  beforeEach(async () => {
    ({ app, authorizationRequestRepo } = await buildTestApp());
  });

  afterEach(async () => {
    await app.close();
  });

  async function createAuthorizationRequest(username = 'darthjee') { /* unchanged */ }

  describe('approver routes', () => {
    // login helper + mine / authorize / deny / X-Skip-Cache header, unchanged
  });
});
```

## Files to Change

- `backend/src/auth/tests/authorization-request.controller.approver.e2e-spec.ts` — new file; the `approver routes` describe block plus the `createAuthorizationRequest` helper, moved verbatim.
