import { IsNotEmpty, IsOptional, IsString } from 'class-validator';
import { UserFieldChangesDto } from './user-field-changes.dto.js';

/**
 * Request body for `PATCH /auth/account.json`. At least one of `username`,
 * `email`, or `newPassword` must be present — that rule is business logic
 * enforced by `AccountService`, not a per-field decorator here. No
 * `newPasswordConfirmation` field — matching `RegisterDto`/`ResetPasswordDto`,
 * password confirmation equality is a client-only UX check.
 */
export class UpdateAccountDto extends UserFieldChangesDto {
  @IsString()
  @IsNotEmpty()
    currentPassword!: string;

  /**
   * The caller's current refresh token, identifying the session to keep when
   * `newPassword` is set — every other session of the caller is revoked. If
   * it is missing or is not one of the caller's active tokens, all of the
   * caller's sessions are revoked (fail safe). Ignored when the password is
   * not being changed.
   */
  @IsOptional()
  @IsString()
    refreshToken?: string;
}
