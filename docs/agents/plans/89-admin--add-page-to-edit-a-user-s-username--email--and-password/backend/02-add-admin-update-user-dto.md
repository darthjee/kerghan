# Add AdminUpdateUserDto

New DTO for the admin edit endpoint, mirroring `UpdateAccountDto`
(`backend/src/auth/dto/update-account.dto.ts`) minus `currentPassword`:

```ts
export class AdminUpdateUserDto {
  @IsOptional()
  @IsString()
  @IsNotEmpty()
    username?: string;

  @IsOptional()
  @IsEmail()
    email?: string;

  @IsOptional()
  @IsString()
  @MinLength(8)
    newPassword?: string;
}
```

No `newPasswordConfirmation` field — matching `UpdateAccountDto`/`RegisterDto`/`ResetPasswordDto`,
that check stays client-side only (see [plan.md](../plan.md)'s Shared contracts). The "at least one
field present" rule is business logic (enforced in `AdminService.editUser`, step 03), not a
per-field/class-level decorator here, same split `UpdateAccountDto`/`AccountService` already use.

## Files to Change

- `backend/src/auth/dto/admin-update-user.dto.ts` — new file, `AdminUpdateUserDto` as above.
