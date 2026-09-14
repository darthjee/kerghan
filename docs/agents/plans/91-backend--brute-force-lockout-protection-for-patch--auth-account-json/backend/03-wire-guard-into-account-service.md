# Wire the guard into `AccountService`/`AuthModule`

Inject `AccountEditAbuseGuardService` into `AccountService` (`backend/src/auth/account.service.ts`)
and change `updateAccount` to:

1. Check `isLockedOut(userId)` first (before touching password/username/email validation at all —
   a locked-out caller shouldn't be able to keep probing which field is wrong) and throw a new
   locked-out error if so.
2. On any of the three existing failure paths — wrong `currentPassword`
   (`#verifyCurrentPassword`), duplicate `username`/`email` (`#assertNewValuesAvailable`) — call
   `registerFailure(userId)` before re-throwing/letting the existing exception propagate, per the
   issue's clarified "any failed validation attempt" scope.
3. On success, call `reset(userId)` before returning.

Represent the locked-out response as a `423 Locked` (`HttpStatus.LOCKED` from `@nestjs/common`) via
a plain `HttpException`, distinct from the existing `BadRequestException`s used for wrong-password
and taken-username/email — since the caller is already authenticated as this exact user, there's
no enumeration risk in naming the lockout explicitly (e.g. `"Account temporarily locked due to too
many failed attempts"`).

No controller changes needed — `AuthController#updateAccount` (`backend/src/auth/auth.controller.ts`)
already just propagates whatever `AccountService#updateAccount` throws.

## Files to Change

- `backend/src/auth/account.service.ts` — inject `AccountEditAbuseGuardService`; add the
  lock-check/register-failure/reset calls described above.
