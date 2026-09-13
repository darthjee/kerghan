# Add AccountService

Create a new dedicated `AccountService` (not a further addition to `AuthService`, which is
already at 258/300 lines — see [backend.md](../backend.md)'s Notes) with a single public method,
e.g. `updateAccount(userId: number, dto: UpdateAccountDto)`:

1. Validate at least one of `dto.username`, `dto.email`, `dto.newPassword` is present; throw
   `BadRequestException` otherwise.
2. Load the user by `userId`.
3. Verify `dto.currentPassword` against the user's `passwordDigest`, reusing the same
   bcrypt-compare helper `AuthService`'s login flow already uses. On mismatch, throw
   `BadRequestException('Invalid current password')` and make no changes.
4. If `dto.username` is present and differs from the current value, run the self-exclusion
   duplicate check from step 02; on collision throw
   `BadRequestException('Username already in use')`.
5. If `dto.email` is present and differs from the current value, same check, throwing
   `BadRequestException('Email already in use')`.
6. Apply the provided updates (`username`, `email`, and/or a newly-hashed `passwordDigest` for
   `dto.newPassword`, using the same hashing approach as `#register`) and save the user entity.
7. Do **not** call `#revokeTokenFamily` or otherwise touch refresh tokens/sessions — this
   self-service flow deliberately leaves other active sessions untouched (per the issue's
   Expected Behavior).
8. Return the updated `{username, email}`.

## Files to Change
- `backend/src/auth/account.service.ts` — new service implementing the method above.
