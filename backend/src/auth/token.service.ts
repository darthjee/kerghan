import { randomBytes, randomUUID } from 'node:crypto';
import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { JwtService } from '@nestjs/jwt';
import { InjectRepository } from '@nestjs/typeorm';
import { IsNull, LessThan, Not, Repository } from 'typeorm';
import { LoggerService } from '../core/logger.service.js';
import { getNumberConfig } from '../core/numeric-config.js';
import { hashToken } from '../core/token-hash.js';
import { RefreshToken, RevokedReason } from './entities/refresh-token.entity.js';
import { User } from './entities/user.entity.js';

// Default regular refresh-token lifetime (7 days, in milliseconds) used when
// `KERGHAN_REFRESH_TOKEN_TTL_MS` is unset, non-numeric or not positive.
const DEFAULT_REFRESH_TOKEN_TTL_MS = 7 * 24 * 60 * 60 * 1000;

// Default persistent ("keep me signed in") refresh-token lifetime (30 days,
// in milliseconds) used when `KERGHAN_PERSISTENT_REFRESH_TOKEN_TTL_MS` is
// unset, non-numeric or not positive.
const DEFAULT_PERSISTENT_REFRESH_TOKEN_TTL_MS = 30 * 24 * 60 * 60 * 1000;

const REFRESH_TOKEN_TTL_KEY = 'KERGHAN_REFRESH_TOKEN_TTL_MS';
const PERSISTENT_REFRESH_TOKEN_TTL_KEY = 'KERGHAN_PERSISTENT_REFRESH_TOKEN_TTL_MS';

/**
 * The identity of a session (one chain of rotated refresh tokens): its UUID
 * and the time its login happened. Copied onto every replacement token.
 */
export interface SessionIdentity {
  sessionUuid: string;
  startedAt: Date;
}

export interface AuthResult {
  user: User;
  accessToken: string;
  refreshToken: string;
  /** The minted refresh-token row's `expiresAt`, used as the session cookies' expiry. */
  refreshTokenExpiresAt: Date;
}

/**
 * Session minting for the Auth module: signs the stateless access-token JWT,
 * and persists a SHA-256-hashed rotating refresh token. Split out of `AuthService` so the
 * device-authorization flow can mint a login session byte-for-byte identical
 * to a password login without duplicating the logic (the two paths cannot
 * drift). Not exported from `AuthModule` — an internal collaborator only,
 * same as `PasswordResetService`. Depends only on injected repositories and
 * services — never reads env vars or global state directly (per
 * `docs/agents/contributing.md`'s DI rule).
 *
 * Refresh tokens get one of two TTLs, read from config on every mint (so a
 * change applies only to newly minted tokens): the regular TTL
 * (`KERGHAN_REFRESH_TOKEN_TTL_MS`, default 7 days) or, for a "keep me signed
 * in" session, the persistent TTL (`KERGHAN_PERSISTENT_REFRESH_TOKEN_TTL_MS`,
 * default 30 days). An unset/non-numeric value falls back to the default; a
 * value `<= 0` also falls back, logging a warning once per key.
 *
 * Every mint also prunes the minting user's expired refresh-token rows
 * (opportunistic, per-user cleanup — no scheduler), keeping
 * `auth_refresh_tokens` bounded. This cannot weaken replay detection:
 * `AuthService#findActiveRefreshToken` rejects an expired token before it
 * looks at `revokedAt`/`revokedReason`, so only unexpired revoked rows matter
 * for detection, and those are kept.
 */
@Injectable()
export class TokenService {
  private readonly refreshTokenRepository: Repository<RefreshToken>;
  private readonly jwtService: JwtService;
  private readonly configService: ConfigService;
  private readonly logger: LoggerService;
  readonly #warnedTtlKeys = new Set<string>();

  /**
   * @param {Repository<RefreshToken>} refreshTokenRepository - The refresh-token repository.
   * @param {JwtService} jwtService - Signs the access token.
   * @param {ConfigService} configService - Supplies the regular and
   *   persistent refresh-token TTLs.
   * @param {LoggerService} logger - The injected Core logger, used to warn
   *   about a non-positive configured TTL.
   */
  constructor(
    @InjectRepository(RefreshToken) refreshTokenRepository: Repository<RefreshToken>,
      jwtService: JwtService,
      configService: ConfigService,
      logger: LoggerService,
  ) {
    this.refreshTokenRepository = refreshTokenRepository;
    this.jwtService = jwtService;
    this.configService = configService;
    this.logger = logger;
  }

  /**
   * Mints a fresh login session for the given user: signs the access-token
   * JWT (`{ sub, username, isAdmin }`), persists a new SHA-256-hashed
   * `RefreshToken` row (`revokedAt: null`, carrying `keepSignedIn`, with the
   * persistent TTL when `keepSignedIn` is `true` and the regular TTL
   * otherwise). Shared by the
   * password-login (`AuthService`) and device-authorization paths so both
   * mint sessions identically. With no `session`, a new session identity is
   * minted (fresh UUID, `startedAt` = now); on rotation the presented token's
   * `session` is passed in and copied over, the same way `keepSignedIn` is.
   * Before saving, the user's rows whose `expiresAt` is already in the past
   * are deleted; revoked-but-unexpired rows are kept (replay detection needs
   * them) and other users' rows are never touched.
   * @param {User} user - The user to mint a session for.
   * @param {boolean} [keepSignedIn] - Whether this is a persistent ("keep me
   *   signed in") session; defaults to `false`.
   * @param {SessionIdentity} [session] - The existing session to carry over
   *   on rotation; omitted for a new login.
   * @returns {Promise<AuthResult>} The user plus the freshly issued
   *   access/refresh token pair and the refresh token's expiry.
   */
  async issueTokens(
    user: User,
    keepSignedIn = false,
    session?: SessionIdentity,
  ): Promise<AuthResult> {
    const accessToken = this.jwtService.sign({
      sub: user.id,
      username: user.username,
      isAdmin: user.isAdmin,
    });
    const refreshToken = randomBytes(48).toString('hex');
    const refreshTokenExpiresAt = new Date(Date.now() + this.#refreshTokenTtlMs(keepSignedIn));

    await this.refreshTokenRepository.delete({ userId: user.id, expiresAt: LessThan(new Date()) });

    await this.refreshTokenRepository.save(
      this.refreshTokenRepository.create({
        tokenHash: this.hashToken(refreshToken),
        userId: user.id,
        expiresAt: refreshTokenExpiresAt,
        revokedAt: null,
        revokedReason: null,
        keepSignedIn,
        sessionUuid: session?.sessionUuid ?? randomUUID(),
        startedAt: session?.startedAt ?? new Date(),
      }),
    );

    return { user, accessToken, refreshToken, refreshTokenExpiresAt };
  }

  /**
   * Hashes a plaintext token with SHA-256, as stored in
   * `auth_refresh_tokens.token_hash`. Exposed (rather than kept private) so
   * `AuthService`'s refresh-token read paths hash exactly the same way the
   * mint path does — the two cannot drift.
   * @param {string} token - The plaintext token to hash.
   * @returns {string} The SHA-256 hex digest of the token.
   */
  hashToken(token: string): string {
    return hashToken(token);
  }

  /**
   * Revokes (sets `revokedAt` to now and `revokedReason` to `reason`) every
   * unrevoked refresh token of the given user, optionally keeping one presented token alive. The kept token
   * is excluded by its SHA-256 hash *within this user's own rows*, so it
   * survives only if it is one of the user's unrevoked tokens: a foreign or
   * unknown token matches none of the user's rows and excludes nothing, so
   * every token is revoked (fail safe); an already-revoked token stays
   * revoked; an expired-but-unrevoked kept row is harmless because
   * `AuthService#refresh` already rejects it as expired. Shared by the
   * replay/compromise path, password reset, My Account password change and
   * admin password edit, so the "revoke a user's tokens" paths cannot drift.
   * @param {number} userId - The user whose refresh tokens are revoked.
   * @param {RevokedReason} reason - Why the tokens are revoked, recorded on
   *   every revoked row.
   * @param {string} [keepRefreshToken] - The plaintext refresh token of the
   *   current session to keep alive, if any.
   * @returns {Promise<void>} Resolves once the tokens are revoked.
   */
  async revokeUserTokens(userId: number, reason: RevokedReason, keepRefreshToken?: string): Promise<void> {
    const criteria = keepRefreshToken
      ? { userId, revokedAt: IsNull(), tokenHash: Not(this.hashToken(keepRefreshToken)) }
      : { userId, revokedAt: IsNull() };

    await this.refreshTokenRepository.update(criteria, { revokedAt: new Date(), revokedReason: reason });
  }

  #refreshTokenTtlMs(keepSignedIn: boolean): number {
    return keepSignedIn
      ? this.#resolveTtl(PERSISTENT_REFRESH_TOKEN_TTL_KEY, DEFAULT_PERSISTENT_REFRESH_TOKEN_TTL_MS)
      : this.#resolveTtl(REFRESH_TOKEN_TTL_KEY, DEFAULT_REFRESH_TOKEN_TTL_MS);
  }

  #resolveTtl(key: string, fallback: number): number {
    const ttl = getNumberConfig(this.configService, key, fallback);

    if (ttl > 0) {
      return ttl;
    }

    if (!this.#warnedTtlKeys.has(key)) {
      this.#warnedTtlKeys.add(key);
      this.logger.warn('non-positive refresh-token TTL configured, using default', {
        context: 'TokenService',
        key,
        fallback,
      });
    }

    return fallback;
  }
}
