import { IsEmail, IsNotEmpty, IsOptional, IsString, MinLength } from 'class-validator';

/**
 * Request body for `PATCH /auth/account.json`. At least one of `username`,
 * `email`, or `newPassword` must be present — that rule is business logic
 * enforced by `AccountService`, not a per-field decorator here. No
 * `newPasswordConfirmation` field — matching `RegisterDto`/`ResetPasswordDto`,
 * password confirmation equality is a client-only UX check.
 */
export class UpdateAccountDto {
  @IsString()
  @IsNotEmpty()
    currentPassword!: string;

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
