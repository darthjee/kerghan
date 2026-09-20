# Issue: Refactor: dedupe repoMock test helper across password-reset.service.spec.ts and token.service.spec.ts

## Description
Two auth unit spec files share a byte-identical generic fake-repository test helper, and a third uses a near-identical variant that differs only by one extra stub.

## Problem
`src/auth/tests/password-reset.service.spec.ts` and `src/auth/tests/token.service.spec.ts` each declare an identical `RepoMock<T extends object>` type and `repoMock<T>()` factory (`findOneBy`, `create`, `save`, `update`, plus `Partial<T>`), confirmed byte-for-byte identical. `auth.service.spec.ts` declares the same helper plus an extra `findOne: jest.fn()` stub. This is exactly the "repeated setup code in tests" the project's contributing guide calls out, and there's already a precedent for a per-service shared repo mock (`authorization-request.service.test-support.ts`'s own `repoMock<T>()`) — the pattern just isn't applied here.

## Expected Behavior
A single shared generic repo-mock helper exists for auth unit specs; the three specs that adopt it behave identically to before.

## Solution
Add a shared `src/auth/tests/repo-mock.test-support.ts` exporting a generic `repoMock<T>()`/`RepoMock<T>` with stubs for `findOne`, `findOneBy`, `create`, `save` (resolving `{ id: 1, ...entity }`) and `update`. Update `password-reset.service.spec.ts`, `token.service.spec.ts` and `auth.service.spec.ts` to import it instead of each declaring their own copy.

Out of scope:
- `account.service.spec.ts` and `user-update.service.spec.ts` — their `save` stub returns `entity` as-is (no `id` injected), so they are not drop-in replacements.
- The `repoMock` in `authorization-request.service.test-support.ts` and the local variants in `account-edit-abuse-guard`, `authorization-request-abuse-guard` and `admin.service` specs — different shapes/defaults.

## Benefits
Removes a byte-identical duplicated test helper (and a near-duplicate) and gives future auth unit specs a ready-made shared fixture, consistent with how `authorization-request.service.test-support.ts` already centralizes this for its own spec family.
