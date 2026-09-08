# Tests

## Unit spec

`backend/src/auth/tests/authorization-request.service.spec.ts` — cover:
- `create` with a matching username and with a non-matching one (asserts identical return shape,
  `userId: null` persisted for the non-matching row, only `sha256(pollToken)` stored).
- `poll` for each status: `open` (not expired), `denied`, `logged` (already resolved).
- The `affected`-rows claim guard: mock `createQueryBuilder().update().set().where().execute()`
  returning `{ affected: 1 }` (winner path — asserts `tokenService.issueTokens` called and
  `authorization-request.logged` emitted) and `{ affected: 0 }` (loser path — asserts no token
  issuance, `{ status: 'logged' }` returned).
- Lazy expiry: an `open` row past `expiresAt` flips to `expired` with `resolvedAt` set, and the
  claim `UPDATE` never writes `resolvedAt`.
- Uniform `404` for both an unknown `uuid` and a wrong `pollToken`.
- `authorization-request.created` emitted on `create`.

## e2e spec

`backend/src/auth/tests/authorization-request.controller.e2e-spec.ts` — supertest +
`cookieParser()`, mirroring `auth.controller.e2e-spec.ts`'s setup. Per Step 4's note,
`createInMemoryRepo` is duplicated per spec file (not shared) — write a local copy for this file,
extended with a `createQueryBuilder().update().set(...).where(...).execute()` stub returning
`{ affected }`, since neither existing copy (`auth.controller.e2e-spec.ts` or
`admin.controller.e2e-spec.ts`) has one.

Cover:
- Full flow: `create → poll(open) → [manually flip the fake row to approved] → poll(approved:
  asserts Set-Cookie + refreshToken) → poll(logged: no credential body)`.
- Expiry path: an overdue `open` row polled returns `{ status: 'expired' }`.
- Wrong poll token → `404`.
- Two simultaneous post-approval polls → exactly one gets the credential body (simulate the race
  via the `createQueryBuilder` stub's `affected` count, consistent with the standing no-live-DB
  note — CI has no live MySQL service).
- `X-Skip-Cache: true` asserted on every response from both routes.

## Files to Change

- `backend/src/auth/tests/authorization-request.service.spec.ts` — new.
- `backend/src/auth/tests/authorization-request.controller.e2e-spec.ts` — new.

## CI Checks

- `backend`: `npm run coverage` (CI job: `backend_tests`)
- `backend`: `npm run lint` (CI job: `backend_checks`)
