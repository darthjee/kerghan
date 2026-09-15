# Split off abuse hardening and remove the original file

Create `backend/src/auth/tests/authorization-request.controller.abuse-hardening.e2e-spec.ts`, covering the original `describe('rate limiting and abuse hardening', ...)` block (lines 588–773 of the original file), which itself nests:

- `create — per-IP limit` — rejects the 6th create from the same IP without persisting a row.
- `create — per-username limit` — rejects the 6th create for the same username from a fresh IP (`fillUsernameLimit` helper included).
- `create — concurrent open cap` — evicts the oldest open row instead of rejecting once the cap is reached.
- `authorize — cool-off lockout` — its own login helper (same shape as the approver scenario's).
- `DTO length caps` — oversized username/password rejected with 400.

These tests exercise non-default limits via `buildTestApp(configOverrides)`, so keep the `configOverrides` usage exactly as in the original.

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

  describe('rate limiting and abuse hardening', () => {
    // create per-IP limit / per-username limit / concurrent open cap / authorize cool-off lockout / DTO length caps, unchanged
  });
});
```

After this file is created, delete the original `backend/src/auth/tests/authorization-request.controller.e2e-spec.ts` — every describe block it contained now lives in one of the four new spec files, and its shared helpers now live in `authorization-request.controller.e2e-test-support.ts` (step 01).

Finally, run `npm run coverage` and `npm run lint` from `backend/` to confirm all four new spec files pass and nothing in the original 773-line file was dropped or duplicated, and that each new file is under the 300-line cap.

## Files to Change

- `backend/src/auth/tests/authorization-request.controller.abuse-hardening.e2e-spec.ts` — new file; the `rate limiting and abuse hardening` describe block plus the `createAuthorizationRequest` helper, moved verbatim.
- `backend/src/auth/tests/authorization-request.controller.e2e-spec.ts` — deleted; fully superseded by the five files from steps 01–05.
