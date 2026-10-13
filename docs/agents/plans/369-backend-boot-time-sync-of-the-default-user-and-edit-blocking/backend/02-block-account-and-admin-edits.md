# Block edits in AccountService and AdminService

Inject `DefaultUserService` and apply the block at the positions defined in edit-blocking.md's "Order of checks". Today every editable field is managed, so for the two edit endpoints the block applies to any request that passes `assertAnyFieldPresent`. Implement it as "contains any managed field" (`username`, `email`, `newPassword`; presence, not value) through a small shared helper, for example `hasManagedField(dto)` next to `assertAnyFieldPresent`, so that a future unmanaged field stays editable.

- `AccountService.updateAccount`: right after `assertAnyFieldPresent(dto)` and **before** `#assertNotLockedOut`, call `defaultUserService.assertNotDefaultUser(userId)` when `hasManagedField(dto)`. It runs outside `#applyGuardedChecks`, so it never calls `registerFailure`, never checks `currentPassword`, and never resets the lockout.
- `AdminService.editUser`: after `assertAnyFieldPresent` and `#findUserOrThrow` (keep the `404` first), before `assertAvailableForUpdate`.
- `AdminService.generateRecoveryLink` / `sendRecoveryEmail`: after `#findUserOrThrow`, before `issueToken`. No token is created and no email is sent.
- Update `account.service.spec.ts` and `admin.service.spec.ts`: a blocked request returns the `409` even when values equal the stored ones; a wrong `currentPassword` still gets `409`; `registerFailure`/`reset` are not called; a locked-out default user gets `409`, not `423`; a request with no field still gets `400`; an unknown id still gets `404`; recovery-link/send-recovery-email create no token and send nothing; other users are unaffected; when disabled, behavior is unchanged.

## Files to Change
- `backend/src/auth/assert-any-field-present.ts` (or a sibling file) — `hasManagedField` helper.
- `backend/src/auth/account.service.ts` — inject `DefaultUserService`, add the early block.
- `backend/src/auth/admin.service.ts` — inject `DefaultUserService`, block `editUser`, `generateRecoveryLink`, `sendRecoveryEmail`.
- `backend/src/auth/tests/account.service.spec.ts`, `backend/src/auth/tests/admin.service.spec.ts` — new cases; adjust constructors.
