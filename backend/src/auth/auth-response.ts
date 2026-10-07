import { ConfigService } from '@nestjs/config';
import type { Response } from 'express';
import { setSessionCookies } from './auth-cookies.js';
import { User } from './entities/user.entity.js';
import type { AuthResult } from './token.service.js';

/**
 * Shared login-session response shape: sets the session cookies (httpOnly
 * `access_token` and `refresh_token`, readable `logged_in`) via
 * {@link setSessionCookies} and returns `{ user }` with `user` serialized
 * through {@link serializeUser}. The refresh token never appears in the body.
 * Used by both the password-login/refresh/register routes (`AuthController`)
 * and the device-authorization "approved" poll response
 * (`AuthorizationRequestController`), so the two cannot drift apart. Cache
 * headers (`X-Skip-Cache`/`Cache-Control`) come from the owning controllers'
 * `@CachePolicy(CacheClass.Never)` via the global `CachePolicyInterceptor`.
 * @param {AuthResult} result - The freshly issued session (user + access/refresh tokens).
 * @param {Response} res - Used to set the session cookies.
 * @param {ConfigService} configService - Supplies the access-token TTL used for the cookie's `maxAge`.
 * @returns {object} `{ user }`, `user` serialized as `{ id, username, email, isAdmin }`.
 */
export function respondWithSession(
  result: AuthResult,
  res: Response,
  configService: ConfigService,
): object {
  setSessionCookies(res, result, configService);

  return { user: serializeUser(result.user) };
}

/**
 * Serializes a {@link User} into its public view.
 * @param {User} user - The user to serialize.
 * @returns {object} `{ id, username, email, isAdmin }`.
 */
export function serializeUser(user: User): object {
  return { id: user.id, username: user.username, email: user.email, isAdmin: user.isAdmin };
}
