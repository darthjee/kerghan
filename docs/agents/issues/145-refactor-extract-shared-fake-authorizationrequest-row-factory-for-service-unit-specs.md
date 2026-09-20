# Issue: Refactor: extract shared fake AuthorizationRequest row factory for service unit specs

## Description
Four `AuthorizationRequestService` unit spec files each build an equivalent fake `AuthorizationRequest` row inline instead of sharing a factory.

## Problem
`src/auth/tests/authorization-request.service.authorize.spec.ts` (`openRow`), `.deny.spec.ts` (`openRow`), `.listOpenForUser.spec.ts` (`openRow`), and `.poll.spec.ts` (`baseRow`) each construct an equivalent 12-14-field fake row (`id`, `uuid`, `username`, `userId`, `status`, `pollTokenHash: sha256('poll-token')`, `requestIp`, `requestUserAgent`, `approvedByUserId`, `createdAt`/`expiresAt`, `resolvedAt`, `loggedAt`, and in `authorize.spec.ts` also the lockout fields `authorizeFailedAttempts`/`authorizeLockedUntil`), copy-pasted with only cosmetic differences (per-file `id`/`uuid` values; `poll.spec.ts` omits `status`/`createdAt`; `deny`/`listOpenForUser` omit the lockout fields). This is precisely the "fake entity object copy-pasted across multiple spec files" case the project convention calls out, and all four files already import from the shared `authorization-request.service.test-support.ts`, which is the natural home for a factory.

## Expected Behavior
A shared factory produces the default fake `AuthorizationRequest` row with sensible defaults (open, not expired, `pollTokenHash: sha256('poll-token')`, zeroed lockout counters); each spec overrides only the fields it needs (e.g. its own `id`/`uuid`). Test behavior is unchanged: no assertion, expected uuid, or test name changes.

## Solution
Add `buildFakeAuthorizationRequest(overrides?: Partial<AuthorizationRequest>): AuthorizationRequest` to `authorization-request.service.test-support.ts`, and update all four spec files to call it with per-test overrides instead of redefining the row literal.

- Defaults: `id: 10`, `uuid: 'uuid-1'` (the values `authorize`/`poll` already use). `deny` overrides with `id: 20, uuid: 'uuid-2'` and `listOpenForUser` with `id: 1, uuid: 'uuid-open'`, so existing assertions stay untouched.
- The return type is the full `AuthorizationRequest` entity (cast where needed), so the factory stops compiling if the entity gains a required field.

## Benefits
Removes four near-identical inline object literals, makes each spec's setup clearer (only the overridden fields relevant to that test are visible), and keeps the fake row's shape in one place if `AuthorizationRequest`'s fields ever change.
