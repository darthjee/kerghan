# Issue: Refactor: Drop the unnecessary optional chain in account-edit-abuse-guard.service.ts

## Description
`AccountEditAbuseGuardService#isDuplicateUserIdError` (`backend/src/auth/account-edit-abuse-guard.service.ts`) casts `error: unknown` to an object type and then still uses `?.` on it. It decides whether a failed `save` in `registerFailure` lost the unique-`user_id` insert race (MySQL `ER_DUP_ENTRY`), in which case `#recoverFromInsertRace` re-fetches the winner row instead of re-throwing.

## Problem
`@typescript-eslint/no-unnecessary-condition` (High) at `backend/src/auth/account-edit-abuse-guard.service.ts:128`: "Unnecessary optional chain on a non-nullish value". The `as { driverError?: { code?: string } }` cast tells the compiler the value is never nullish, while `error` is really `unknown` and may be null. The cast also reads `driverError.code` before the `instanceof QueryFailedError` check, so the type check and the property read are decoupled.

## Expected Behavior
Duplicate-key detection returns the same result for every input:
- `QueryFailedError` whose `driverError.code === MYSQL_DUPLICATE_ENTRY_CODE` → `true` (race recovery runs).
- Anything else — a non-`QueryFailedError` value (including `null`/`undefined`), a `QueryFailedError` with a different code, or one whose `driverError` is missing or has no `code` → `false` (the error is re-thrown).

No lint suppressions are added.

## Solution
Scope: backend only (`backend/src/auth/account-edit-abuse-guard.service.ts` and its spec `backend/src/auth/tests/account-edit-abuse-guard.service.spec.ts`).

- Check `error instanceof QueryFailedError` first and return `false` otherwise; no cast on `error`.
- TypeORM types `driverError` as `Error` (no `code` property), so read it as `unknown` (e.g. `const driverError: unknown = error.driverError`) and narrow with `typeof driverError === 'object' %%SOLUTION%%%%SOLUTION%% driverError !== null %%SOLUTION%%%%SOLUTION%% 'code' in driverError` before comparing `driverError.code` to `MYSQL_DUPLICATE_ENTRY_CODE`. This avoids both the cast and `?.` while staying safe if the driver error is absent at runtime.
- Spec: keep the existing race-recovery case (`ER_DUP_ENTRY`) and the plain-`Error` re-throw case, and add re-throw cases for a `QueryFailedError` with a different `code` and a `QueryFailedError` with no `driverError` / no `code`.

## Benefits
Removes a High Codacy finding and replaces an unsafe cast with real type narrowing, making the race-recovery guard's contract explicit and fully covered by specs.

## Verification

- `docker-compose run --rm kerghan_tests yarn lint` and `docker-compose run --rm kerghan_tests yarn coverage` pass, with coverage not reduced.
- After merge, Codacy's re-analysis of `main` no longer reports the finding listed under **Problem**.

---
Source: Codacy static analysis of `main` (grade B, 538 open issues at the time of filing).
