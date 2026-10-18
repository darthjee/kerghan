# Default user and seeds

`DefaultUserService`: `#createOrUpdate` creates the default user with `status: 'approved'`, and
`#update` forces `user.status = 'approved'` on every boot sync (so a pending or denied default
user is approved again). No session revocation tied to this change.

Seeds: the existing demo seed migrations (`20260824120004-auth-seed-demo-user.ts`,
`20260903120007-…`) run before the status migration, so the backfill covers them; leave them
untouched. Update every test fixture / helper that creates a `User` to set `status` explicitly
(default `approved` in helpers like `tests/support/auth-requests.ts#registerUser`,
`tests/support/default-user-e2e.ts`), so tests reflect the NOT NULL column.

Tests (model.md): boot sync creates the default user `approved`, and forces a `pending` and a
`denied` default user back to `approved`.

## Files to Change
- `backend/src/auth/default-user.service.ts` — managed `status`.
- `backend/src/auth/tests/default-user.service.spec.ts` — coverage.
- `backend/src/auth/tests/support/*.ts` and specs that build users — explicit `status`.
