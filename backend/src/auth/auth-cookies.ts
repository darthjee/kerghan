import { ConfigService } from '@nestjs/config';
import type { CookieOptions, Request, Response } from 'express';
import type { AuthResult } from './token.service.js';

export const ACCESS_TOKEN_COOKIE = 'access_token';
export const REFRESH_TOKEN_COOKIE = 'refresh_token';
export const LOGGED_IN_COOKIE = 'logged_in';
export const REFRESH_TOKEN_COOKIE_PATH = '/auth';

// Default access-token lifetime (15 minutes, in milliseconds) used when
// `KERGHAN_ACCESS_TOKEN_TTL_MS` is unset — must match `app.module.ts`'s
// `JwtModule.registerAsync` default so the cookie's `maxAge` always tracks
// the signed JWT's actual expiry.
const DEFAULT_ACCESS_TOKEN_TTL_MS = 15 * 60 * 1000;

const BASE_OPTIONS: CookieOptions = { secure: true, sameSite: 'strict' };

const ACCESS_TOKEN_OPTIONS: CookieOptions = { ...BASE_OPTIONS, httpOnly: true, path: '/' };
const REFRESH_TOKEN_OPTIONS: CookieOptions = {
  ...BASE_OPTIONS,
  httpOnly: true,
  path: REFRESH_TOKEN_COOKIE_PATH,
};
const LOGGED_IN_OPTIONS: CookieOptions = { ...BASE_OPTIONS, httpOnly: false, path: '/' };

/**
 * Sets the three session cookies on a session-minting response: the httpOnly
 * `access_token` (path `/`, access-token TTL), the httpOnly `refresh_token`
 * (path `/auth`, expiring with the refresh-token row) and the
 * script-readable `logged_in=1` marker (path `/`, same expiry as the refresh
 * token) the frontend uses for its optimistic login state.
 * @param {Response} res - The response to set the cookies on.
 * @param {AuthResult} result - The freshly issued session.
 * @param {ConfigService} configService - Supplies the access-token TTL.
 * @returns {void}
 */
export function setSessionCookies(res: Response, result: AuthResult, configService: ConfigService): void {
  const refreshMaxAge = Math.max(0, result.refreshTokenExpiresAt.getTime() - Date.now());

  res.cookie(ACCESS_TOKEN_COOKIE, result.accessToken, {
    ...ACCESS_TOKEN_OPTIONS,
    maxAge: configService.get<number>('KERGHAN_ACCESS_TOKEN_TTL_MS', DEFAULT_ACCESS_TOKEN_TTL_MS),
  });
  res.cookie(REFRESH_TOKEN_COOKIE, result.refreshToken, { ...REFRESH_TOKEN_OPTIONS, maxAge: refreshMaxAge });
  res.cookie(LOGGED_IN_COOKIE, '1', { ...LOGGED_IN_OPTIONS, maxAge: refreshMaxAge });
}

/**
 * Clears the three session cookies, each with the same `path`/`secure`/
 * `sameSite` options it was set with so browsers actually drop it.
 * @param {Response} res - The response to clear the cookies on.
 * @returns {void}
 */
export function clearSessionCookies(res: Response): void {
  res.clearCookie(ACCESS_TOKEN_COOKIE, ACCESS_TOKEN_OPTIONS);
  res.clearCookie(REFRESH_TOKEN_COOKIE, REFRESH_TOKEN_OPTIONS);
  res.clearCookie(LOGGED_IN_COOKIE, LOGGED_IN_OPTIONS);
}

/**
 * Reads the plaintext refresh token from the httpOnly `refresh_token` cookie.
 * @param {Request} req - The incoming request (parsed by `cookie-parser`).
 * @returns {string | undefined} The refresh token, or `undefined` when the
 *   cookie is absent or empty.
 */
export function readRefreshToken(req: Request): string | undefined {
  const token: unknown = req.cookies?.[REFRESH_TOKEN_COOKIE];

  return typeof token === 'string' && token !== '' ? token : undefined;
}
