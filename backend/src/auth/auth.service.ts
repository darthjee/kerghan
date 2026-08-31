import { randomBytes, createHash } from 'node:crypto';
import { BadRequestException, Injectable, UnauthorizedException } from '@nestjs/common';
import { EventEmitter2 } from '@nestjs/event-emitter';
import { JwtService } from '@nestjs/jwt';
import { InjectRepository } from '@nestjs/typeorm';
import bcrypt from 'bcryptjs';
import { IsNull, Repository } from 'typeorm';
import { LoginDto } from './dto/login.dto.js';
import { RegisterDto } from './dto/register.dto.js';
import { RefreshToken } from './entities/refresh-token.entity.js';
import { Session } from './entities/session.entity.js';
import { User } from './entities/user.entity.js';
import { UserRegisteredEvent } from './events/user-registered.event.js';

// A pre-computed bcrypt hash of a value nobody will ever submit, compared
// against when no user is found so lookups for unknown usernames take the
// same time as a wrong-password check (avoids trivial timing-based
// username enumeration) — ported from the old Authenticator.
const DUMMY_DIGEST = '$2a$10$CwTycUXWue0Thq9StjUM0uJ8Q1eLXfPJvXQF4RUOgtnJhmiQq6Zsy';

const REFRESH_TOKEN_TTL_MS = 7 * 24 * 60 * 60 * 1000;

export interface AuthResult {
  user: User;
  accessToken: string;
  refreshToken: string;
}

/**
 * Auth module business logic: credential verification, registration,
 * stateless-JWT issuance, and refresh-token rotation. Ported from the old
 * `Authenticator`/`Registrar` (`backend/lib/accounts/`), adapted to NestJS
 * DI and TypeORM repositories. Depends only on injected repositories and
 * services — never reads env vars or global state directly (per
 * `docs/agents/contributing.md`'s DI rule).
 */
@Injectable()
export class AuthService {
  private readonly userRepository: Repository<User>;
  private readonly refreshTokenRepository: Repository<RefreshToken>;
  private readonly sessionRepository: Repository<Session>;
  private readonly jwtService: JwtService;
  private readonly eventEmitter: EventEmitter2;

  /**
   * @param {Repository<User>} userRepository - The Auth module's user repository.
   * @param {Repository<RefreshToken>} refreshTokenRepository - The refresh-token repository.
   * @param {Repository<Session>} sessionRepository - The session repository.
   * @param {JwtService} jwtService - Signs/verifies the access token.
   * @param {EventEmitter2} eventEmitter - Fires the `user.registered` event.
   */
  constructor(
    @InjectRepository(User) userRepository: Repository<User>,
    @InjectRepository(RefreshToken) refreshTokenRepository: Repository<RefreshToken>,
    @InjectRepository(Session) sessionRepository: Repository<Session>,
      jwtService: JwtService,
      eventEmitter: EventEmitter2,
  ) {
    this.userRepository = userRepository;
    this.refreshTokenRepository = refreshTokenRepository;
    this.sessionRepository = sessionRepository;
    this.jwtService = jwtService;
    this.eventEmitter = eventEmitter;
  }

  /**
   * Registers a new user and immediately logs them in (issues tokens),
   * per the issue's JWT flow ("issued on login/register/refresh").
   * @param {RegisterDto} dto - The registration payload.
   * @returns {Promise<AuthResult>} The created user plus access/refresh tokens.
   * @throws {BadRequestException} When the username/email are already taken.
   */
  async register(dto: RegisterDto): Promise<AuthResult> {
    await this.#assertAvailable(dto.username, dto.email);

    const passwordDigest = await bcrypt.hash(dto.password, 10);
    const user = await this.userRepository.save(
      this.userRepository.create({
        username: dto.username,
        email: dto.email,
        passwordDigest,
      }),
    );

    this.eventEmitter.emit(
      'user.registered',
      new UserRegisteredEvent(user.id, user.username, user.email),
    );

    return this.#issueTokens(user);
  }

  /**
   * Verifies a username/password pair and issues a fresh token pair.
   * @param {LoginDto} dto - The login credentials.
   * @returns {Promise<AuthResult>} The authenticated user plus access/refresh tokens.
   * @throws {UnauthorizedException} When the username is unknown or the password is wrong.
   */
  async login(dto: LoginDto): Promise<AuthResult> {
    const user = await this.#validateCredentials(dto.username, dto.password);

    return this.#issueTokens(user);
  }

  /**
   * Rotates a refresh token: the presented token is revoked and a new
   * access/refresh pair is issued, preventing replay of the old one.
   *
   * Presenting a token that is specifically already-revoked (as opposed to
   * merely expired) is treated as a compromise signal per standard
   * refresh-token-rotation guidance: it means someone is replaying a token
   * whose rotated successor already exists, so every other currently-active
   * refresh token belonging to that user is revoked too, forcing re-login,
   * before the 401 is thrown.
   * @param {string} refreshToken - The refresh token presented by the client.
   * @returns {Promise<AuthResult>} The user plus the newly issued token pair.
   * @throws {UnauthorizedException} When the token is unknown, expired, or already revoked.
   */
  async refresh(refreshToken: string): Promise<AuthResult> {
    const tokenRow = await this.#findActiveRefreshToken(refreshToken);
    const user = await this.userRepository.findOneBy({ id: tokenRow.userId });

    if (!user) {
      throw new UnauthorizedException('Invalid refresh token');
    }

    await this.refreshTokenRepository.update(tokenRow.id, { revokedAt: new Date() });

    return this.#issueTokens(user);
  }

  /**
   * Invalidates a refresh token server-side, ending the session it
   * belongs to.
   * @param {string} refreshToken - The refresh token to invalidate.
   * @returns {Promise<void>} Resolves once the token has been revoked.
   */
  async logout(refreshToken: string): Promise<void> {
    const tokenHash = this.#hashToken(refreshToken);

    await this.refreshTokenRepository.update({ tokenHash }, { revokedAt: new Date() });
  }

  /**
   * Reports whether a refresh token currently identifies an active
   * session, without mutating anything. Deliberately distinct from
   * `#findActiveRefreshToken` (used by `refresh()`), which revokes the
   * user's entire token family and throws when it finds an
   * already-revoked token — the correct replay-detection behavior for a
   * token-consuming flow, but unsafe to reuse here: a passive status check
   * must never revoke or rotate anything, or a second tab's routine
   * mount-time confirmation could log every tab out after the first tab's
   * legitimate refresh.
   * @param {string} refreshToken - The refresh token presented by the client.
   * @returns {Promise<{ loggedIn: boolean }>} `{ loggedIn: true }` only when
   *   the token is known, unrevoked, and unexpired; `{ loggedIn: false }`
   *   for every other case (missing, unknown, revoked, or expired).
   */
  async status(refreshToken: string): Promise<{ loggedIn: boolean }> {
    return { loggedIn: await this.#isActiveToken(refreshToken) };
  }

  async #assertAvailable(username: string, email: string): Promise<void> {
    const existing = await this.userRepository.findOne({
      where: [{ username }, { email }],
    });

    if (!existing) {
      return;
    }

    const field = existing.username === username ? 'username' : 'email';
    throw new BadRequestException(`${field} is not available`);
  }

  async #findActiveRefreshToken(refreshToken: string): Promise<RefreshToken> {
    const tokenHash = this.#hashToken(refreshToken);
    const tokenRow = await this.refreshTokenRepository.findOneBy({ tokenHash });

    if (!tokenRow) {
      throw new UnauthorizedException('Invalid or expired refresh token');
    }

    if (tokenRow.revokedAt) {
      await this.#revokeTokenFamily(tokenRow.userId);
      throw new UnauthorizedException('Invalid or expired refresh token');
    }

    if (tokenRow.expiresAt < new Date()) {
      throw new UnauthorizedException('Invalid or expired refresh token');
    }

    return tokenRow;
  }

  #hashToken(token: string): string {
    return createHash('sha256').update(token).digest('hex');
  }

  async #isActiveToken(refreshToken: string): Promise<boolean> {
    const tokenHash = this.#hashToken(refreshToken);
    const tokenRow = await this.refreshTokenRepository.findOneBy({ tokenHash });

    return !!tokenRow && !tokenRow.revokedAt && tokenRow.expiresAt > new Date();
  }

  async #issueTokens(user: User): Promise<AuthResult> {
    const accessToken = this.jwtService.sign({ sub: user.id, username: user.username });
    const refreshToken = randomBytes(48).toString('hex');

    await this.refreshTokenRepository.save(
      this.refreshTokenRepository.create({
        tokenHash: this.#hashToken(refreshToken),
        userId: user.id,
        expiresAt: new Date(Date.now() + REFRESH_TOKEN_TTL_MS),
        revokedAt: null,
      }),
    );

    await this.#touchSession(user.id);

    return { user, accessToken, refreshToken };
  }

  async #revokeTokenFamily(userId: number): Promise<void> {
    await this.refreshTokenRepository.update(
      { userId, revokedAt: IsNull() },
      { revokedAt: new Date() },
    );
  }

  async #touchSession(userId: number): Promise<void> {
    await this.sessionRepository.save(
      this.sessionRepository.create({ userId, lastSeenAt: new Date() }),
    );
  }

  async #validateCredentials(username: string, password: string): Promise<User> {
    const user = await this.userRepository.findOneBy({ username });
    const digest = user?.passwordDigest ?? DUMMY_DIGEST;
    const valid = await bcrypt.compare(password, digest);

    if (!user || !valid) {
      throw new UnauthorizedException('Invalid username or password');
    }

    return user;
  }
}
