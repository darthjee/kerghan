# Issue: Refactor: consolidate admin.controller.e2e-spec.ts fake repository with existing test-support helpers

## Description
The backend auth e2e specs share fake TypeORM repositories via two `*.e2e-test-support.ts` helpers, but `admin.controller.e2e-spec.ts` still reimplements its own fake repository and test-app bootstrap. The two existing helpers each also carry their own private `createInMemoryRepo`.

## Problem
`src/auth/tests/admin.controller.e2e-spec.ts` defines a private ~60-line `createInMemoryRepo<T>()` (rows array, `create`/`findOne`/`find`/`findOneBy`/`save`/`update`) plus its own `Test.createTestingModule` + repository-override + `cookieParser`/`ValidationPipe` boilerplate — almost identical to `auth.controller.e2e-test-support.ts`'s `buildTestApp()`, except it also wires `AdminGuard` as a second `APP_GUARD`, does not pre-register the default `darthjee` user, and adds an `ilike`-aware `find()`. Its top-of-file comment acknowledges it "mirrors" the auth e2e pattern rather than factoring it out.

The duplication is wider than the admin spec: `auth.controller.e2e-test-support.ts` and `authorization-request.controller.e2e-test-support.ts` each define their own `matchesCondition` + `createInMemoryRepo` (the latter a superset with `moreThan`, `find({ order })`, `count`, `createQueryBuilder().update()...execute()` and `createdAt` auto-fill). That makes three independently-diverged copies of the same fake repository.

## Expected Behavior
There is a single shared in-memory fake repository (and `matchesCondition` helper) used by every auth e2e spec and support file, and `admin.controller.e2e-spec.ts` builds its app through the shared `buildTestApp()` instead of a private copy. All existing e2e tests keep passing unchanged.

## Solution
- Extract one superset `createInMemoryRepo<T>()` and `matchesCondition` into a new neutral module (e.g. `src/auth/tests/support/in-memory-repo.ts`), supporting: `isNull`, `moreThan` and `ilike` operators, `find()` with optional `where`/`order`, `findOne`, `findOneBy`, `count`, `save` (with `createdAt` auto-fill, as real TypeORM does), `update`, and the `createQueryBuilder().update().set().where().execute()` stub.
- Make `auth.controller.e2e-test-support.ts` and `authorization-request.controller.e2e-test-support.ts` import the shared repo instead of defining their own (re-exporting `createInMemoryRepo`/`matchesCondition` if that keeps existing spec imports unchanged).
- Extend `auth.controller.e2e-test-support.ts`'s `buildTestApp()` with an options object, e.g. `buildTestApp({ adminGuard: true, registerDefaultUser: false })`, where `adminGuard` registers `AdminGuard` as a second `APP_GUARD` and `registerDefaultUser: false` skips the up-front `POST /auth/register.json` for `darthjee`. Defaults preserve current behavior so no other auth spec changes.
- Update `admin.controller.e2e-spec.ts` to use `buildTestApp` from the support file and delete its private `createInMemoryRepo`.
- `authorization-request.controller.e2e-test-support.ts`'s own `buildTestApp` (with `configOverrides`) is out of scope and stays separate.

## Benefits
Removes all duplicate copies of the fake-repository pattern, keeps every auth e2e spec on one maintained fixture, and prevents the copies from silently diverging (e.g. a missing repository method or operator that another spec relies on).
