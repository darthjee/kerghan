# Backend Plan: Refactor: Drop the unnecessary optional chain in account-edit-abuse-guard.service.ts

Main plan: [plan.md](plan.md)

## Overview
Behavior-preserving refactor of the duplicate-key detection used by `registerFailure`'s insert-race recovery, plus spec coverage for each input shape.

## Context
`backend/src/auth/account-edit-abuse-guard.service.ts:127-131` currently reads:

```ts
#isDuplicateUserIdError(error: unknown): boolean {
  const code = (error as { driverError?: { code?: string } })?.driverError?.code;

  return error instanceof QueryFailedError && code === MYSQL_DUPLICATE_ENTRY_CODE;
}
```

The cast makes the compiler treat `error` as non-nullish, so `?.` is flagged as an unnecessary condition (Codacy High). TypeORM declares `QueryFailedError<T extends Error = Error>` with `readonly driverError: T`, and `Error` has no `code` property — so after `instanceof` narrowing, `.code` still isn't typed. The value must be widened to `unknown` and narrowed structurally.

`#recoverFromInsertRace` re-throws when this returns `false`, and re-fetches the winner row when it returns `true`.

## Implementation Steps

### Step 1 — Rewrite `#isDuplicateUserIdError` with real narrowing
Replace the method body with:

```ts
#isDuplicateUserIdError(error: unknown): boolean {
  if (!(error instanceof QueryFailedError)) {
    return false;
  }

  const driverError: unknown = error.driverError;

  return (
    typeof driverError === 'object' &&
    driverError !== null &&
    'code' in driverError &&
    driverError.code === MYSQL_DUPLICATE_ENTRY_CODE
  );
}
```

No casts, no `?.`, no eslint-disable comments. Assigning to an `unknown`-typed local is what keeps `typeof`/`!== null` from being flagged as unnecessary (the declared `Error` type would otherwise make them look redundant). If lint still flags anything, adjust the narrowing (e.g. a small local type-guard function) rather than suppressing.

### Step 2 — Extend the guard spec
In `backend/src/auth/tests/account-edit-abuse-guard.service.spec.ts`, under `describe('registerFailure')`, keep the existing `ER_DUP_ENTRY` race-recovery case and the plain-`Error` re-throw case, and add re-throw cases following the plain-`Error` case's shape (`findOne` → `null`, `save` rejects, `expect(guard.registerFailure(1)).rejects.toThrow(error)`, and assert `update` was not called):

- a `QueryFailedError` whose driver error has a different code (e.g. `{ code: 'ER_LOCK_DEADLOCK' }`);
- a `QueryFailedError` whose driver error has no `code` (e.g. `new Error('boom')`);
- a `QueryFailedError` constructed with `undefined as never` as the driver error;
- a non-`Error` rejection value (e.g. `null`), which must be re-thrown as-is (use `rejects.toBeNull()` / `rejects.toBe(value)` as appropriate).

## Files to Change
- `backend/src/auth/account-edit-abuse-guard.service.ts` — rewrite `#isDuplicateUserIdError` (Step 1).
- `backend/src/auth/tests/account-edit-abuse-guard.service.spec.ts` — add re-throw cases (Step 2).

## CI Checks
- `backend`: `docker-compose run --rm kerghan_tests yarn lint` (CI job: `backend_checks`)
- `backend`: `docker-compose run --rm kerghan_tests yarn coverage` (CI job: `backend_tests`)

## Notes
- Pure refactor: public behavior of `registerFailure` must not change; the existing race-recovery spec is the regression guard.
- Never run `yarn` on the host — always via `docker-compose`.
- `MYSQL_DUPLICATE_ENTRY_CODE` and its comment stay as they are.
