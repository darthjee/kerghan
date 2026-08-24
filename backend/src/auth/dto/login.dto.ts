import { IsNotEmpty, IsString } from 'class-validator';

/** Request body for `POST /auth/login`. */
export class LoginDto {
  @IsString()
  @IsNotEmpty()
  username!: string;

  @IsString()
  @IsNotEmpty()
  password!: string;
}
