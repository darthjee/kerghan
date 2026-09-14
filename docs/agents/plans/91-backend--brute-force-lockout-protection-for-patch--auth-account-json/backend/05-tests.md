# Tests

Add `backend/src/auth/tests/account-edit-abuse-guard.service.spec.ts`, mirroring
`authorization-request-abuse-guard.service.spec.ts`'s mocked-repository style: cover
`isLockedOut` (no row / not-yet-locked / locked / expired-lock-is-treated-as-not-locked),
`registerFailure` (increments below threshold, sets `lockedUntil` once the default-5 threshold is
hit, respects a configured non-default `KERGHAN_ACCOUNT_EDIT_MAX_ATTEMPTS`), and `reset` (clears
both fields).

Update `backend/src/auth/tests/account.service.spec.ts` to cover: a locked-out user gets the
`423`/locked error without the password/availability checks running; a wrong-password or
duplicate-username/email failure calls `registerFailure`; a successful update calls `reset`.

Update `backend/src/auth/tests/auth.controller.e2e-spec.ts` if it exercises
`PATCH /auth/account.json` end-to-end, adding a case that repeats failed attempts past the
threshold and asserts the `423` response.

## Files to Change

- `backend/src/auth/tests/account-edit-abuse-guard.service.spec.ts` — new spec.
- `backend/src/auth/tests/account.service.spec.ts` — add lockout/reset/registerFailure coverage.
- `backend/src/auth/tests/auth.controller.e2e-spec.ts` — add an end-to-end lockout case, if this
  file already covers `PATCH /auth/account.json`.
