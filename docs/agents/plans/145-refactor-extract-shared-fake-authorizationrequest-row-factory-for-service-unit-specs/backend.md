# Backend Plan: Refactor: extract shared fake AuthorizationRequest row factory for service unit specs

Main plan: [plan.md](plan.md)

## Overview
Four `AuthorizationRequestService` unit specs under `backend/src/auth/tests/` each define an equivalent fake `AuthorizationRequest` row inline. Extract one factory into the already-shared `authorization-request.service.test-support.ts` and use it from all four.

## Context
- The current literals are `openRow` in `authorization-request.service.authorize.spec.ts` (id `10`, uuid `uuid-1`, includes lockout fields), `openRow` in `.deny.spec.ts` (id `20`, uuid `uuid-2`), `openRow` in `.listOpenForUser.spec.ts` (id `1`, uuid `uuid-open`), and `baseRow` in `.poll.spec.ts` (id `10`, uuid `uuid-1`, no `status`/`createdAt`).
- The entity (`src/auth/entities/authorization-request.entity.ts`) has exactly 15 fields: `id`, `uuid`, `username`, `userId`, `status`, `pollTokenHash`, `requestIp`, `requestUserAgent`, `approvedByUserId`, `createdAt`, `expiresAt`, `resolvedAt`, `loggedAt`, `authorizeFailedAttempts`, `authorizeLockedUntil`. A complete literal therefore satisfies `AuthorizationRequest` without a cast.
- Decisions from the issue discussion: defaults are `id: 10`, `uuid: 'uuid-1'`; `deny` and `listOpenForUser` override with their own `id`/`uuid` so no assertion changes; the return type is the full `AuthorizationRequest`.
- Adding the lockout fields, `status: 'open'` and `createdAt` to the deny/listOpenForUser/poll rows is behavior-neutral: the service only reads `status`, `expiresAt`, `userId`, `id`, `uuid` and `createdAt` from these rows. Every `poll` test that cares about `status` already overrides it explicitly.

## Implementation Steps

### Step 1 — Add `buildFakeAuthorizationRequest` to the test-support module
In `authorization-request.service.test-support.ts` add (with a JSDoc block matching the surrounding helpers, which `eslint` requires):

```ts
export function buildFakeAuthorizationRequest(overrides: Partial<AuthorizationRequest> = {}): AuthorizationRequest {
  return {
    id: 10,
    uuid: 'uuid-1',
    username: 'darthjee',
    userId: 1,
    status: 'open',
    pollTokenHash: sha256('poll-token'),
    requestIp: '203.0.113.1',
    requestUserAgent: 'curl/8.0',
    approvedByUserId: null,
    createdAt: new Date(),
    expiresAt: new Date(Date.now() + 60000),
    resolvedAt: null,
    loggedAt: null,
    authorizeFailedAttempts: 0,
    authorizeLockedUntil: null,
    ...overrides,
  };
}
```

The function builds a fresh object (and fresh `Date`s) on every call, so specs must not share a mutated instance. `sha256` is already defined in the same file.

### Step 2 — Replace the four inline literals
In each spec, delete the local row literal, add `buildFakeAuthorizationRequest` to the existing test-support import, and define the row via the factory:
- `authorize.spec.ts`: `const openRow = buildFakeAuthorizationRequest();` (defaults already match).
- `deny.spec.ts`: `buildFakeAuthorizationRequest({ id: 20, uuid: 'uuid-2' })`.
- `listOpenForUser.spec.ts`: `buildFakeAuthorizationRequest({ id: 1, uuid: 'uuid-open' })`.
- `poll.spec.ts`: `const baseRow = buildFakeAuthorizationRequest();`.

Keep the existing `{ ...openRow, ... }` spreads inside tests as they are. Drop the `sha256` import from any spec that no longer uses it directly (ESLint flags unused imports). No assertion, uuid or test name changes.

## Files to Change
- `backend/src/auth/tests/authorization-request.service.test-support.ts` — add `buildFakeAuthorizationRequest`.
- `backend/src/auth/tests/authorization-request.service.authorize.spec.ts` — use the factory for `openRow`.
- `backend/src/auth/tests/authorization-request.service.deny.spec.ts` — use the factory with `id`/`uuid` overrides.
- `backend/src/auth/tests/authorization-request.service.listOpenForUser.spec.ts` — use the factory with `id`/`uuid` overrides.
- `backend/src/auth/tests/authorization-request.service.poll.spec.ts` — use the factory for `baseRow`.

## CI Checks
- `backend`: `docker-compose run --rm kerghan_tests yarn test` (CI job: backend tests, `npm run coverage`)
- `backend`: `docker-compose run --rm kerghan_tests yarn lint` (CI job: backend lint, `npm run lint`)

## Notes
- The test-support file must stay within the 300-line ESLint limit; it is currently about 110 lines, so there is room.
- Confirm the exact docker-compose service used for backend lint (`kerghan_tests` is assumed, as `kerghan_app` runs the dev watcher).
