import { IsBoolean, IsNotEmpty, IsOptional, IsString } from 'class-validator';

/** Request body for `POST /auth/login.json`. */
export class LoginDto {
  @IsString()
  @IsNotEmpty()
    username!: string;

  @IsString()
  @IsNotEmpty()
    password!: string;

  /**
   * Requests a persistent ("keep me signed in") session. Strictly a JSON
   * boolean — `"true"`/`1` are rejected with `400` (no coercion).
   */
  @IsOptional()
  @IsBoolean()
    keepSignedIn?: boolean;
}
