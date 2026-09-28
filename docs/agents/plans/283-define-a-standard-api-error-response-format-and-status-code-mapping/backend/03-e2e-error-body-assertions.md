# Assert error bodies in e2e specs

Add e2e assertions on the actual response body (not just the status) so frontend/backend shape
mismatches like #42 are caught:

- **Validation failure** (e.g. `register.json` with a missing or invalid field): `400`,
  `error.code === 'VALIDATION_FAILED'`, `error.details` is a non-empty array, `error.message` is a
  string, `statusCode === 400`, `timestamp` is an ISO string.
- **Conflict** (`register.json` with a taken username): `409`, `error.code === 'USERNAME_TAKEN'`,
  `error.message === 'username is not available'`. Add the email equivalent (`EMAIL_TAKEN`).
- **Auth failure** (protected route without a token, or bad login): `401`,
  `error.code === 'UNAUTHORIZED'`, the expected message, and no `details`.
- **Forbidden** (admin route as a non-admin, or the CSRF origin rejection): `403`, `FORBIDDEN`.
- **Not found** (unknown authorization request poll): `404`, `NOT_FOUND`.
- **Locked** (account edit after the lockout threshold): `423`, `LOCKED`.

Put them in the existing spec files that already cover these flows.

## Files to Change
- `backend/src/auth/tests/auth.controller.account.e2e-spec.ts` — validation, conflict and locked body assertions.
- `backend/src/auth/tests/auth.controller.login.e2e-spec.ts` / `auth.controller.guard.e2e-spec.ts` — 401 body assertions.
- `backend/src/auth/tests/admin.controller.e2e-spec.ts` or `auth.controller.csrf.e2e-spec.ts` — 403 body assertion.
- `backend/src/auth/tests/authorization-request.controller.poll.e2e-spec.ts` — 404 body assertion.
