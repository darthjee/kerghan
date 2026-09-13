# Add UpdateAccountDto

Create a new DTO for `PATCH /auth/account.json`, mirroring the validation style of
`RegisterDto` (`backend/src/auth/dto/register.dto.ts`) and `ResetPasswordDto`
(`backend/src/auth/dto/reset-password.dto.ts:9-17`):

- `currentPassword: string` — `@IsString() @IsNotEmpty()`
- `username?: string` — `@IsOptional() @IsString() @IsNotEmpty()`
- `email?: string` — `@IsOptional() @IsEmail()`
- `newPassword?: string` — `@IsOptional() @IsString() @MinLength(8)`

No `newPasswordConfirmation` field — matching the existing convention that confirmation equality
is a client-side-only concern (`RegisterDto`/`ResetPasswordDto` have no confirmation field
either), and the global `ValidationPipe` uses `whitelist: true`.

The "at least one of `username`/`email`/`newPassword` must be present" rule is business logic, not
a per-field decorator — validate it in the service (see step 03), not here.

## Files to Change
- `backend/src/auth/dto/update-account.dto.ts` — new DTO as described above.
