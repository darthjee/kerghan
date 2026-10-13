import { IsEmail, IsNotEmpty, IsString, MinLength } from 'class-validator';
import { PASSWORD_MIN_LENGTH } from '../password-rules.js';

/** Request body for `POST /auth/register.json`. */
export class RegisterDto {
  @IsString()
  @IsNotEmpty()
    username!: string;

  @IsEmail()
    email!: string;

  @IsString()
  @MinLength(PASSWORD_MIN_LENGTH)
    password!: string;
}
