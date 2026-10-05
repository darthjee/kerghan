import { Injectable, NotFoundException, UnauthorizedException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { IsNull, MoreThan, Not, Repository } from 'typeorm';
import { RefreshToken, RevokedReason } from './entities/refresh-token.entity.js';
import { TokenService } from './token.service.js';

/**
 * One of a user's active sessions, as listed by `SessionService#listActive`.
 * `lastUsedAt` is the active token's `issuedAt` (the latest login or
 * rotation); `current` marks the session the caller is using.
 */
export interface ActiveSession {
  id: string;
  startedAt: Date;
  lastUsedAt: Date;
  keepSignedIn: boolean;
  current: boolean;
}

/**
 * Lists and revokes a user's own sessions. A session is one chain of rotated
 * refresh tokens sharing a `sessionUuid`; since rotation revokes the
 * presented token, an active session is exactly one non-revoked, unexpired
 * `auth_refresh_tokens` row. Every query is scoped to the caller's `userId`,
 * so another user's session is indistinguishable from a missing one. Not
 * exported from `AuthModule` — an internal collaborator only. Depends only on
 * injected repositories/services — never reads env vars or global state.
 */
@Injectable()
export class SessionService {
  private readonly refreshTokenRepository: Repository<RefreshToken>;
  private readonly tokenService: TokenService;

  /**
   * @param {Repository<RefreshToken>} refreshTokenRepository - The refresh-token repository.
   * @param {TokenService} tokenService - Hashes presented tokens.
   */
  constructor(
    @InjectRepository(RefreshToken) refreshTokenRepository: Repository<RefreshToken>,
      tokenService: TokenService,
  ) {
    this.refreshTokenRepository = refreshTokenRepository;
    this.tokenService = tokenService;
  }

  /**
   * Lists the user's active (non-revoked, unexpired) sessions, most recently
   * used first. The session whose token matches `refreshToken` is marked
   * `current`; an unknown or invalid token marks nothing and never throws.
   * @param {number} userId - The caller's own user ID.
   * @param {string} refreshToken - The caller's refresh token, identifying
   *   the current session.
   * @returns {Promise<ActiveSession[]>} The caller's active sessions.
   */
  async listActive(userId: number, refreshToken: string): Promise<ActiveSession[]> {
    const rows = await this.refreshTokenRepository.find({
      where: { userId, revokedAt: IsNull(), expiresAt: MoreThan(new Date()) },
      order: { issuedAt: 'DESC' },
    });
    const currentHash = this.tokenService.hashToken(refreshToken);

    return rows.map((row) => ({
      id: row.sessionUuid,
      startedAt: row.startedAt,
      lastUsedAt: row.issuedAt,
      keepSignedIn: row.keepSignedIn,
      current: row.tokenHash === currentHash,
    }));
  }

  /**
   * Revokes one of the user's sessions (its unrevoked token, reason
   * `user_revoked`). Revoking the current session is allowed and behaves
   * like a logoff. Only the refresh token is revoked: the session's
   * already-issued access-token JWT stays valid until it expires.
   * @param {number} userId - The caller's own user ID.
   * @param {string} sessionUuid - The session to revoke.
   * @returns {Promise<void>} Resolves once the session is revoked.
   * @throws {NotFoundException} When no unrevoked token of that session
   *   belongs to the user (unknown, foreign or already revoked session).
   */
  async revoke(userId: number, sessionUuid: string): Promise<void> {
    const result = await this.refreshTokenRepository.update(
      { userId, sessionUuid, revokedAt: IsNull() },
      { revokedAt: new Date(), revokedReason: RevokedReason.USER_REVOKED },
    );

    if (!result.affected) {
      throw new NotFoundException('Session not found');
    }
  }

  /**
   * Revokes every session of the user except the current one (reason
   * `user_revoked`). The presented token must be one of the user's active
   * tokens; otherwise nothing is revoked, so this never falls back to
   * revoking every session. The current session is kept by its
   * `sessionUuid`, not by the presented token's hash, so a concurrent
   * rotation of the current session (whose new token has a different hash)
   * is never revoked by mistake.
   * @param {number} userId - The caller's own user ID.
   * @param {string} refreshToken - The caller's refresh token, identifying
   *   the session to keep.
   * @returns {Promise<void>} Resolves once the other sessions are revoked.
   * @throws {UnauthorizedException} When the token is unknown, revoked,
   *   expired or another user's.
   */
  async revokeOthers(userId: number, refreshToken: string): Promise<void> {
    const row = await this.refreshTokenRepository.findOneBy({
      tokenHash: this.tokenService.hashToken(refreshToken),
    });

    if (!this.#isActiveOwnToken(row, userId)) {
      throw new UnauthorizedException('Invalid or expired refresh token');
    }

    await this.refreshTokenRepository.update(
      { userId, sessionUuid: Not(row.sessionUuid), revokedAt: IsNull() },
      { revokedAt: new Date(), revokedReason: RevokedReason.USER_REVOKED },
    );
  }

  #isActiveOwnToken(row: RefreshToken | null, userId: number): row is RefreshToken {
    return !!row && row.userId === userId && !row.revokedAt && row.expiresAt > new Date();
  }
}
