import { Injectable, NotFoundException, UnauthorizedException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { IsNull, MoreThan, Not, Repository } from 'typeorm';
import { SessionLookup, SessionUser } from '../core/session-lookup.js';
import { RefreshToken, RevokedReason } from './entities/refresh-token.entity.js';
import { User, UserStatus } from './entities/user.entity.js';
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
 * so another user's session is indistinguishable from a missing one.
 *
 * Also implements Core's `SessionLookup` (`findActiveSessionUser`), which
 * `JwtGuard` uses on every authenticated request; `AuthModule` exports it
 * only under the `SESSION_LOOKUP` token, never as `SessionService` itself.
 * Depends only on injected repositories/services — never reads env vars or
 * global state.
 */
@Injectable()
export class SessionService implements SessionLookup {
  private readonly refreshTokenRepository: Repository<RefreshToken>;
  private readonly tokenService: TokenService;
  private readonly userRepository: Repository<User>;

  /**
   * @param {Repository<RefreshToken>} refreshTokenRepository - The refresh-token repository.
   * @param {TokenService} tokenService - Hashes presented tokens.
   * @param {Repository<User>} userRepository - The user repository, joined
   *   to the session row by `findActiveSessionUser`.
   */
  constructor(
    @InjectRepository(RefreshToken) refreshTokenRepository: Repository<RefreshToken>,
      tokenService: TokenService,
    @InjectRepository(User) userRepository: Repository<User>,
  ) {
    this.refreshTokenRepository = refreshTokenRepository;
    this.tokenService = tokenService;
    this.userRepository = userRepository;
  }

  /**
   * Loads the user of the active (non-revoked, unexpired) session `sid`, in
   * one query over the indexed `session_uuid` joined to `auth_users` on the
   * row's `user_id` (an in-module join: both tables belong to Auth). Only an
   * `approved` user is returned (gate rule 3): a `pending` or `denied`
   * user's session resolves to `null`, whatever `KERGHAN_USER_APPROVAL_REQUIRED`
   * says. Since the join is on `user_id`, the returned `id` is the session
   * row's `userId`. A database error propagates.
   * @param {string} sid - The session UUID (the access token's `sid` claim).
   * @returns {Promise<SessionUser | null>} The session's user, or `null`
   *   when no active session of an approved user has that UUID.
   */
  async findActiveSessionUser(sid: string): Promise<SessionUser | null> {
    const user = await this.userRepository
      .createQueryBuilder('user')
      .innerJoin(RefreshToken, 'session', 'session.userId = user.id')
      .select(['user.id', 'user.username', 'user.isAdmin'])
      .where('session.sessionUuid = :sid', { sid })
      .andWhere('session.revokedAt IS NULL')
      .andWhere('session.expiresAt > :now', { now: new Date() })
      .andWhere('user.status = :status', { status: UserStatus.APPROVED })
      .getOne();

    return user ? { id: user.id, username: user.username, isAdmin: user.isAdmin } : null;
  }

  /**
   * Lists the user's active (non-revoked, unexpired) sessions, most recently
   * used first. The session whose token matches `refreshToken` is marked
   * `current`; a missing, unknown or invalid token marks nothing and never throws.
   * @param {number} userId - The caller's own user ID.
   * @param {string} [refreshToken] - The caller's refresh token (from the
   *   `refresh_token` cookie), identifying the current session.
   * @returns {Promise<ActiveSession[]>} The caller's active sessions.
   */
  async listActive(userId: number, refreshToken?: string): Promise<ActiveSession[]> {
    const rows = await this.refreshTokenRepository.find({
      where: { userId, revokedAt: IsNull(), expiresAt: MoreThan(new Date()) },
      order: { issuedAt: 'DESC' },
    });
    const currentHash = refreshToken ? this.tokenService.hashToken(refreshToken) : undefined;

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
   * like a logoff. Revoking the session's refresh token also ends its
   * access tokens: `JwtGuard` rejects any token whose session is no longer
   * active.
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
   * @param {string} [refreshToken] - The caller's refresh token (from the
   *   `refresh_token` cookie), identifying the session to keep.
   * @returns {Promise<void>} Resolves once the other sessions are revoked.
   * @throws {UnauthorizedException} When the token is missing, unknown,
   *   revoked, expired or another user's.
   */
  async revokeOthers(userId: number, refreshToken?: string): Promise<void> {
    const row = refreshToken
      ? await this.refreshTokenRepository.findOneBy({ tokenHash: this.tokenService.hashToken(refreshToken) })
      : null;

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
