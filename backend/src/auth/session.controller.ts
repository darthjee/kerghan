import { Controller, Param, ParseUUIDPipe, Post, Req } from '@nestjs/common';
import type { Request } from 'express';
import { readRefreshToken } from './auth-cookies.js';
import { SessionService } from './session.service.js';
import type { AccessTokenPayload } from '../core/access-token-payload.js';
import { CacheClass } from '../core/cache-class.js';
import { CachePolicy } from '../core/cache-policy.decorator.js';
import { CurrentUser } from '../core/current-user.decorator.js';

/**
 * The caller's own session management — thin, delegating all business logic
 * to `SessionService`. Every route is authenticated through the default
 * (non-`@Public()`) `JwtGuard`, and the caller comes from `@CurrentUser()`.
 * `@CachePolicy(CacheClass.Never)` is applied once at the controller level so
 * Tent's proxy never caches — and cross-serves — a per-caller response.
 */
@Controller('auth')
@CachePolicy(CacheClass.Never)
export class SessionController {
  private readonly sessionService: SessionService;

  /**
   * @param {SessionService} sessionService - The session list/revoke business logic.
   */
  constructor(sessionService: SessionService) {
    this.sessionService = sessionService;
  }

  /**
   * `POST /auth/sessions/mine.json`. Lists the caller's active sessions, most
   * recently used first, marking the one matching the `refresh_token`
   * cookie as `current` (a missing or unknown token marks none, without
   * failing). No request body.
   * @param {Request} req - Carries the caller's `refresh_token` cookie.
   * @param {AccessTokenPayload} user - The caller's own authenticated user, supplying the user ID.
   * @returns {Promise<object>} `{ sessions: [{ id, startedAt, lastUsedAt, keepSignedIn, current }] }`.
   */
  @Post('sessions/mine.json')
  async mine(@Req() req: Request, @CurrentUser() user: AccessTokenPayload): Promise<object> {
    const sessions = await this.sessionService.listActive(user.sub, readRefreshToken(req));

    return { sessions };
  }

  /**
   * `POST /auth/sessions/revoke-others.json`. Revokes every session of the
   * caller except the current one, identified by the `refresh_token`
   * cookie. A missing or invalid current token answers `401` and revokes
   * nothing. No request body.
   * @param {Request} req - Carries the caller's `refresh_token` cookie, identifying the session to keep.
   * @param {AccessTokenPayload} user - The caller's own authenticated user, supplying the user ID.
   * @returns {Promise<object>} `{ revoked: true }`.
   */
  @Post('sessions/revoke-others.json')
  async revokeOthers(@Req() req: Request, @CurrentUser() user: AccessTokenPayload): Promise<object> {
    await this.sessionService.revokeOthers(user.sub, readRefreshToken(req));

    return { revoked: true };
  }

  /**
   * `POST /auth/sessions/:uuid/revoke.json`. Revokes one of the caller's
   * sessions (the current one included, which behaves like a logoff). An
   * unknown session, or another user's, answers `404`; a malformed ID
   * answers `400` (any UUID version is accepted, since migration-backfilled
   * sessions carry MySQL `UUID()` v1 IDs). Only the session's refresh token
   * is revoked — its access-token JWT stays valid until it expires. No
   * request body is expected (any body is ignored).
   * @param {string} uuid - The session ID to revoke.
   * @param {AccessTokenPayload} user - The caller's own authenticated user, supplying the user ID.
   * @returns {Promise<object>} `{ revoked: true }`.
   */
  @Post('sessions/:uuid/revoke.json')
  async revoke(@Param('uuid', ParseUUIDPipe) uuid: string, @CurrentUser() user: AccessTokenPayload): Promise<object> {
    await this.sessionService.revoke(user.sub, uuid);

    return { revoked: true };
  }
}
