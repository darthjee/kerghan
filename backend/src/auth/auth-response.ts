import { ConfigService } from '@nestjs/config';
import type { Response } from 'express';
import { User } from './entities/user.entity.js';
import type { AuthResult } from './token.service.js';

const ACCESS_TOKEN_COOKIE = 'access_token';
// Default access-token lifetime (15 minutes, in milliseconds) used when
// `KERGHAN_ACCESS_TOKEN_TTL_MS` is unset — must match `app.module.ts`'s
// `JwtModule.registerAsync` default so the cookie's `maxAge` always tracks
// the signed JWT's actual expiry.
const DEFAULT_ACCESS_TOKEN_TTL_MS = 15 * 60 * 1000;
// Tent's `default_proxy` rule (`proxy/*_configuration/rules/backend.php`) caches any 2xx
// response to a `*.json` URL by method-agnostic, query-string-only key — these POST routes have
// no query string, so without this header a second caller could be served the first caller's
// cached credentials/tokens. See `docs/agents/architecture/proxy.md`'s "Cache bypass" section.
export const SKIP_CACHE_HEADER = 'X-Skip-Cache';

/**
 * Shared login-session response shape: sets the httpOnly `access_token`
 * cookie, sets `X-Skip-Cache`, and returns `{ user, refreshToken }` with
 * `user` serialized through {@link serializeUser}. Used by both the
 * password-login/refresh/register routes (`AuthController`) and the
 * device-authorization "logged" poll response
 * (`AuthorizationRequestController`), so the two response bodies cannot
 * drift apart.
 * @param {AuthResult} result - The freshly issued session (user + access/refresh tokens).
 * @param {Response} res - Used to set the access-token cookie and the `X-Skip-Cache` header.
 * @param {ConfigService} configService - Supplies the access-token TTL used for the cookie's `maxAge`.
 * @returns {object} `{ user, refreshToken }`, `user` serialized as `{ id, username, email, isAdmin }`.
 */
export function respondWithSession(
  result: AuthResult,
  res: Response,
  configService: ConfigService,
): object {
  const { user, accessToken, refreshToken } = result;

  res.cookie(ACCESS_TOKEN_COOKIE, accessToken, {
    httpOnly: true,
    secure: true,
    sameSite: 'strict',
    maxAge: configService.get<number>('KERGHAN_ACCESS_TOKEN_TTL_MS', DEFAULT_ACCESS_TOKEN_TTL_MS),
  });
  res.set(SKIP_CACHE_HEADER, 'true');

  return { user: serializeUser(user), refreshToken };
}

/**
 * Serializes a {@link User} into its public view.
 * @param {User} user - The user to serialize.
 * @returns {object} `{ id, username, email, isAdmin }`.
 */
export function serializeUser(user: User): object {
  return { id: user.id, username: user.username, email: user.email, isAdmin: user.isAdmin };
}
