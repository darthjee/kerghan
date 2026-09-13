# Add backend tests

Add Jest coverage for the new behavior, following the existing test structure/conventions under
`backend/src/auth/tests/` (or wherever sibling service/controller specs already live).

`AccountService` (unit/service-level):
- Success updating `username` only, `email` only, `newPassword` only, and all three together.
- Wrong `currentPassword` → error, no changes persisted.
- Duplicate `username` → clear error, no changes persisted.
- Duplicate `email` → clear error, no changes persisted.
- No optional fields provided → validation error.
- Updating `username`/`email` to the value the user already has does not false-positive as a
  duplicate (exercises the self-exclusion check from step 02).
- Successful password change does not revoke other sessions/refresh tokens (assert
  `#revokeTokenFamily`-equivalent is not called, or that other tokens remain active).

`AuthController` (controller/e2e-level):
- Unauthenticated request to `PATCH /auth/account.json` is rejected.
- Successful request returns `{username, email}` and sets `X-Skip-Cache: true`.

## Files to Change
- `backend/src/auth/tests/account.service.spec.ts` (or matching existing naming convention) —
  new service tests as described above.
- `backend/src/auth/tests/auth.controller.spec.ts` — add cases for the new endpoint (auth
  rejection, success shape, header).
