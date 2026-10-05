import { Body, Controller, Param, Post } from '@nestjs/common';
import { RefreshTokenDto } from './dto/refresh-token.dto.js';
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
   * recently used first, marking the one matching `dto.refreshToken` as
   * `current` (an unknown token marks none, without failing).
   * @param {RefreshTokenDto} dto - Carries the caller's refresh token.
   * @param {AccessTokenPayload} user - The caller's own authenticated user, supplying the user ID.
   * @returns {Promise<object>} `{ sessions: [{ id, startedAt, lastUsedAt, keepSignedIn, current }] }`.
   */
  @Post('sessions/mine.json')
  async mine(@Body() dto: RefreshTokenDto, @CurrentUser() user: AccessTokenPayload): Promise<object> {
    const sessions = await this.sessionService.listActive(user.sub, dto.refreshToken);

    return { sessions };
  }

  /**
   * `POST /auth/sessions/revoke-others.json`. Revokes every session of the
   * caller except the current one. A missing or invalid current token
   * answers `401` and revokes nothing.
   * @param {RefreshTokenDto} dto - Carries the caller's refresh token, identifying the session to keep.
   * @param {AccessTokenPayload} user - The caller's own authenticated user, supplying the user ID.
   * @returns {Promise<object>} `{ revoked: true }`.
   */
  @Post('sessions/revoke-others.json')
  async revokeOthers(@Body() dto: RefreshTokenDto, @CurrentUser() user: AccessTokenPayload): Promise<object> {
    await this.sessionService.revokeOthers(user.sub, dto.refreshToken);

    return { revoked: true };
  }

  /**
   * `POST /auth/sessions/:uuid/revoke.json`. Revokes one of the caller's
   * sessions (the current one included, which behaves like a logoff). An
   * unknown session, or another user's, answers `404`. The request body is
   * accepted for consistency with the other routes but ignored.
   * @param {string} uuid - The session ID to revoke.
   * @param {AccessTokenPayload} user - The caller's own authenticated user, supplying the user ID.
   * @returns {Promise<object>} `{ revoked: true }`.
   */
  @Post('sessions/:uuid/revoke.json')
  async revoke(@Param('uuid') uuid: string, @CurrentUser() user: AccessTokenPayload): Promise<object> {
    await this.sessionService.revoke(user.sub, uuid);

    return { revoked: true };
  }
}
