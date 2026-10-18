# Approve and deny in AdminService

Add the two status transitions to `AdminService`, documented with JSDoc like the existing methods.

- New `ErrorCodes` entries in `backend/src/core/error-codes.ts`: `USER_NOT_PENDING`,
  `CANNOT_DENY_SELF`.
- `approveUser(userId: number): Promise<User>`: `#findUserOrThrow` (404); if
  `status !== UserStatus.PENDING` throw
  `new UnprocessableEntityException({ code: ErrorCodes.USER_NOT_PENDING, message })`; otherwise
  set `approved`, save, return the reloaded row. Sessions untouched.
- `denyUser(userId: number, callerId: number): Promise<User>`: `#findUserOrThrow` (404) →
  `defaultUserService.assertNotDefaultUser(user.id)` (409) → if `user.id === callerId` throw
  `UnprocessableEntityException({ code: ErrorCodes.CANNOT_DENY_SELF, message })` → set `denied`
  (from any status, a no-op on an already denied user), save, then
  `tokenService.revokeUserTokens(user.id, RevokedReason.ADMIN_DENIED)` (revokes only active
  rows; already-revoked rows keep their reason). Return the reloaded row.
- Prefer a guarded single write for approve (e.g. `update({ id, status: PENDING }, { status:
  APPROVED })` and check `affected`) so two admins approving / denying concurrently cannot
  approve a just-denied user; deny is lenient, so a plain update is fine.
- Unit specs in `admin.service.spec.ts`: approve from pending / approved / denied / unknown;
  deny from each status, unknown, default user, self; revocation called with `ADMIN_DENIED` and
  not called on any refusal.

## Files to Change

- `backend/src/core/error-codes.ts` — two new codes.
- `backend/src/auth/admin.service.ts` — `approveUser`, `denyUser`.
- `backend/src/auth/tests/admin.service.spec.ts` — unit specs.
