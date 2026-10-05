import { IsNotEmpty, IsString } from 'class-validator';

/**
 * Request body carrying the caller's refresh token, for `POST
 * /auth/refresh.json`, `DELETE /auth/logoff.json`, `POST /auth/status.json`,
 * `POST /auth/sessions/mine.json` and `POST /auth/sessions/revoke-others.json`.
 */
export class RefreshTokenDto {
  @IsString()
  @IsNotEmpty()
    refreshToken!: string;
}
