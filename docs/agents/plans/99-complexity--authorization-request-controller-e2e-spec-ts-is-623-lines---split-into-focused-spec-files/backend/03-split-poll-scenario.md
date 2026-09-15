# Split off the poll scenario

Create `backend/src/auth/tests/authorization-request.controller.poll.e2e-spec.ts`, covering the original describe blocks (lines 279–379 of the original file):

- `full poll flow` — open → approved (Set-Cookie + refreshToken) → logged (no credentials).
- `expiry path` — flips an overdue open request to expired.
- `wrong poll token` — 404 for wrong token and for an unknown uuid.
- `concurrent post-approval polls` — grants credentials to exactly one of two simultaneous polls.
- `X-Skip-Cache header` — is set on every poll response.

This scenario uses both `createAuthorizationRequest` and `approve` (per `backend.md`'s Notes), so redeclare both locally against this file's own `app`/`authorizationRequestRepo`, unchanged from the original (lines 225–240):

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
  function approve(uuid: string): void { /* unchanged */ }

  describe('full poll flow', () => { /* ... */ });
  describe('expiry path', () => { /* ... */ });
  describe('wrong poll token', () => { /* ... */ });
  describe('concurrent post-approval polls', () => { /* ... */ });
  describe('X-Skip-Cache header', () => { /* ... */ });
});
```

## Files to Change

- `backend/src/auth/tests/authorization-request.controller.poll.e2e-spec.ts` — new file; the five poll-related describe blocks plus the `createAuthorizationRequest`/`approve` helpers, moved verbatim.
