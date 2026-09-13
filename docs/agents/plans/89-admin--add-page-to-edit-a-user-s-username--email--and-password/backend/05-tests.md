# Tests

Extend the existing spec files rather than adding new ones, following each file's current
structure:

- `backend/src/auth/tests/auth.service.spec.ts` — cover the new `applyUserUpdate` (moved from
  `AccountService`'s old private-method tests, if any existed at that level; otherwise new cases
  for username/email mutation and password hashing).
- `backend/src/auth/tests/account.service.spec.ts` — update existing `updateAccount` specs only as
  needed to account for the delegation to `authService.applyUserUpdate` (mock it the same way
  `assertAvailableForUpdate` is already mocked); behavior/assertions on `updateAccount` itself
  should be unchanged.
- `backend/src/auth/tests/admin.service.spec.ts` — add `editUser` cases: success (username/email/
  password change), duplicate username, duplicate email, password shorter than 8 chars (DTO-level,
  via a `ValidationPipe`-style check or directly asserting the service rejects it if validation
  isn't exercised at this level), unknown user id (`NotFoundException`), no fields present
  (`BadRequestException`), and editing the admin's own id.
- `backend/src/auth/tests/admin.controller.e2e-spec.ts` — add e2e cases for
  `POST admin/users/:id/edit.json`: success, a non-admin/unauthenticated request rejected by
  `@AdminOnly()`, and at least one validation-failure case (duplicate field or short password)
  returning a clean 400 rather than a raw 500.

## Files to Change

- `backend/src/auth/tests/auth.service.spec.ts`
- `backend/src/auth/tests/account.service.spec.ts`
- `backend/src/auth/tests/admin.service.spec.ts`
- `backend/src/auth/tests/admin.controller.e2e-spec.ts`
