import { IsOptional, IsString } from 'class-validator';

/**
 * Optional request body for `POST /auth/refresh.json`.
 *
 * TODO(#324-migration): temporary migration fallback. A client still holding
 * a refresh token in `localStorage` (from before the token moved into the
 * httpOnly `refresh_token` cookie) may send it here once; it is only used
 * when the cookie is absent — the cookie always wins. Remove this DTO, and
 * the fallback branch in `resolveRefreshToken`, once the migration window
 * is over. No other route accepts a body-carried refresh token.
 */
export class RefreshFallbackDto {
  @IsOptional()
  @IsString()
    refreshToken?: string;
}
