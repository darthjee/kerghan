import { IsOptional, IsString, MaxLength } from 'class-validator';

/**
 * Upper bound on a body-carried refresh token. Real tokens are
 * `randomBytes(48).toString('hex')` (96 chars, see `TokenService`), so 128
 * leaves headroom while rejecting oversized payloads before any lookup.
 */
const MAX_REFRESH_TOKEN_LENGTH = 128;

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
  @MaxLength(MAX_REFRESH_TOKEN_LENGTH)
    refreshToken?: string;
}
