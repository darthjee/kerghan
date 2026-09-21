# Issue: Refactor: dedupe authorization-request.service specs (authorize/create setup and repeated cases)

## Description
The authorization-request service specs repeat their context setup and several near-identical test bodies.

## Problem
jscpd, under `backend/src/auth/tests/`:

- `authorization-request.service.authorize.spec.ts` lines 7-24 ↔ `authorization-request.service.create.spec.ts` lines 5-22 (18 lines): the same imports and the same `let ...; beforeEach(() => ({ ... } = createAuthorizationRequestServiceTestContext()))` block. The same block is present in all five `authorization-request.service.*.spec.ts` files (`authorize`, `create`, `deny`, `listOpenForUser`, `poll`); each destructures a different subset of the context (2 to 6 of its members).
- `authorization-request.service.create.spec.ts`: 126-138 ↔ 165-176 (12 lines); `authorization-request.service.authorize.spec.ts`: 98-108 ↔ 113-123 (11 lines).
- `authorization-request-abuse-guard.service.spec.ts` lines 58-64 ↔ `authorization-request.service.create.spec.ts` lines 196-202 (7 lines): the "always computes both the IP and username counts" assertion pair.

## Expected Behavior
The per-file context setup is provided by a shared helper and the repeated cases are parameterised or extracted into local helpers. All specs keep the same assertions.

## Solution
- Extend `authorization-request.service.test-support.ts` with `useAuthorizationRequestServiceContext()`, which registers the `beforeEach` and returns a context object exposing live getters (`service`, `userRepository`, `authorizationRequestRepository`, `tokenService`, `eventEmitter`, `configService`). Convert all five `authorization-request.service.*.spec.ts` files to `const ctx = useAuthorizationRequestServiceContext();` and rewrite their call sites to `ctx.service`, `ctx.userRepository`, etc., removing the per-file `let` declarations and destructuring `beforeEach`.
- Add a shared assertion helper (e.g. `expectBothCreateCountsComputed(repo, ip, username)`) to the test-support file and use it in both `authorization-request.service.create.spec.ts` and `authorization-request-abuse-guard.service.spec.ts`.
- Dedupe the repeated 11-12-line cases in the `create`/`authorize` specs at the implementer's discretion: `it.each` where only inputs differ (e.g. the not-open / expired / wrong-password rejections in `authorize`), small local builders where the arrange step differs (e.g. per-IP vs per-username count-at-limit in `create`).
- All existing assertions must be preserved; no production code changes.

## Benefits
The context helper already exists but each spec file still re-declares its `let`s plus a destructuring `beforeEach`; finishing the job removes that repetition and the cross-spec assertion clone.
