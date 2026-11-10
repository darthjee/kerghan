import { IsEmail, IsNotEmpty, IsOptional, IsString, MinLength } from 'class-validator';
import { PASSWORD_MIN_LENGTH } from '../password-rules.js';

/**
 * The managed user fields (`username`, `email`, `newPassword`) admin user
 * edits accept, extended by `AdminUpdateUserDto`. Also the shape
 * `assertAnyFieldPresent`/`hasManagedField` check against. `UpdateAccountDto`
 * matches it structurally but declares its own copies of these fields, so it
 * can reject `null` for them without changing the admin contract.
 */
export class UserFieldChangesDto {
  @IsOptional()
  @IsString()
  @IsNotEmpty()
    username?: string;

  @IsOptional()
  @IsEmail()
    email?: string;

  @IsOptional()
  @IsString()
  @MinLength(PASSWORD_MIN_LENGTH)
    newPassword?: string;
}
