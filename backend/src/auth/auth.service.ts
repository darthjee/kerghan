import { ConflictException, Injectable, UnauthorizedException } from '@nestjs/common';
import { EventEmitter2 } from '@nestjs/event-emitter';
import { InjectRepository } from '@nestjs/typeorm';
import bcrypt from 'bcryptjs';
import { IsNull, Not, Repository } from 'typeorm';
import { ErrorCodes } from '../core/error-codes.js';
import { LoginDto } from './dto/login.dto.js';
import { RecoverDto } from './dto/recover.dto.js';
import { RegisterDto } from './dto/register.dto.js';
import { ResetPasswordDto } from './dto/reset-password.dto.js';
import { compareOrDummy } from './dummy-digest.js';
import { RefreshToken, RevokedReason } from './entities/refresh-token.entity.js';
import { User } from './entities/user.entity.js';
import { UserRegisteredEvent } from './events/user-registered.event.js';
import { PasswordResetService } from './password-reset.service.js';
import { TokenService, type AuthResult } from './token.service.js';

export type { AuthResult };

// Specific error code attached to the `409` thrown when a field's value is taken.
const TAKEN_CODES = { username: ErrorCodes.USERNAME_TAKEN, email: ErrorCodes.EMAIL_TAKEN } as const;

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
  private readonly tokenService: TokenService;
  private readonly eventEmitter: EventEmitter2;
  private readonly passwordResetService: PasswordResetService;

  /**
   * @param {Repository<User>} userRepository - The Auth module's user repository.
   * @param {Repository<RefreshToken>} refreshTokenRepository - The refresh-token repository.
   * @param {TokenService} tokenService - Mints login sessions and hashes refresh tokens.
   * @param {EventEmitter2} eventEmitter - Fires the `user.registered` event.
   * @param {PasswordResetService} passwordResetService - Recovery/reset logic (`recover`/`resetPassword`).
   */
  constructor(
    @InjectRepository(User) userRepository: Repository<User>,
    @InjectRepository(RefreshToken) refreshTokenRepository: Repository<RefreshToken>,
      tokenService: TokenService,
      eventEmitter: EventEmitter2,
      passwordResetService: PasswordResetService,
  ) {
    this.userRepository = userRepository;
    this.refreshTokenRepository = refreshTokenRepository;
    this.tokenService = tokenService;
    this.eventEmitter = eventEmitter;
    this.passwordResetService = passwordResetService;
  }

  /**
   * Registers a new user and immediately logs them in (issues tokens),
   * per the issue's JWT flow ("issued on login/register/refresh").
   * @param {RegisterDto} dto - The registration payload.
   * @returns {Promise<AuthResult>} The created user plus access/refresh tokens.
   * @throws {ConflictException} When the username/email are already taken (`USERNAME_TAKEN`/`EMAIL_TAKEN`).
   */
  async register(dto: RegisterDto): Promise<AuthResult> {
    await this.#assertAvailable(dto.username, dto.email);

    const passwordDigest = await bcrypt.hash(dto.password, 10);
    const user = await this.userRepository.save(
      this.userRepository.create({
        username: dto.username,
        email: dto.email,
        passwordDigest,
        isAdmin: false,
      }),
    );

    this.eventEmitter.emit(
      'user.registered',
      new UserRegisteredEvent(user.id, user.username, user.email),
    );

    return this.tokenService.issueTokens(user, false);
  }

  /**
   * Verifies a username/password pair and issues a fresh token pair,
   * persistent (longer refresh TTL) only when `dto.keepSignedIn` is `true`.
   * @param {LoginDto} dto - The login credentials and optional `keepSignedIn` flag.
   * @returns {Promise<AuthResult>} The authenticated user plus access/refresh tokens.
   * @throws {UnauthorizedException} When the username is unknown or the password is wrong.
   */
  async login(dto: LoginDto): Promise<AuthResult> {
    const user = await this.#validateCredentials(dto.username, dto.password);

    return this.tokenService.issueTokens(user, dto.keepSignedIn ?? false);
  }

  /**
   * Starts a self-service password recovery. Delegates entirely to
   * `PasswordResetService#recover` — see its doc-comment for the
   * enumeration-safety contract this must uphold.
   * @param {RecoverDto} dto - Carries the email to look up.
   * @returns {Promise<void>} Resolves once the (possible) token/event have
   *   been created, whether or not the email matched an account.
   */
  async recover(dto: RecoverDto): Promise<void> {
    return this.passwordResetService.recover(dto);
  }

  /**
   * Rotates a refresh token: the presented token is revoked (`rotated`) and a
   * new pair is issued, carrying over `keepSignedIn` and the session identity.
   *
   * Presenting an unexpired token revoked *by rotation* is a compromise
   * signal (its successor already exists), so every active token of the user
   * is revoked too (`replay_detected`) before the 401. A token revoked for
   * any other reason (logout, session revoke, password change) or already
   * expired gets a plain 401 with no side effects, so a revoked device's
   * token can't force-logout the user's other sessions. The rotation write
   * only matches a still-unrevoked row, so losing a race to a concurrent
   * revocation or refresh is a plain 401 with no tokens issued.
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

    const { affected } = await this.refreshTokenRepository.update(
      { id: tokenRow.id, revokedAt: IsNull() },
      { revokedAt: new Date(), revokedReason: RevokedReason.ROTATED },
    );

    if (affected !== 1) {
      throw new UnauthorizedException('Invalid or expired refresh token');
    }

    return this.tokenService.issueTokens(user, tokenRow.keepSignedIn, {
      sessionUuid: tokenRow.sessionUuid,
      startedAt: tokenRow.startedAt,
    });
  }

  /**
   * Invalidates a refresh token server-side (reason `logout`), ending its
   * session. An already-revoked token is left untouched.
   * @param {string} refreshToken - The refresh token to invalidate.
   * @returns {Promise<void>} Resolves once the token has been revoked.
   */
  async logout(refreshToken: string): Promise<void> {
    const tokenHash = this.tokenService.hashToken(refreshToken);

    await this.refreshTokenRepository.update(
      { tokenHash, revokedAt: IsNull() },
      { revokedAt: new Date(), revokedReason: RevokedReason.LOGOUT },
    );
  }

  /**
   * Finishes a self-service password recovery: validates the token (via
   * `PasswordResetService#resetPassword`, which throws the uniform
   * rejection error), then revokes every other refresh token belonging to
   * that user, forcing re-login on all of that user's other sessions.
   * @param {ResetPasswordDto} dto - Carries the token and the new password.
   * @returns {Promise<void>} Resolves once the password has been reset and
   *   the user's other sessions revoked.
   * @throws {BadRequestException} When the token is unknown, already used, or expired.
   */
  async resetPassword(dto: ResetPasswordDto): Promise<void> {
    const userId = await this.passwordResetService.resetPassword(dto);

    await this.tokenService.revokeUserTokens(userId, RevokedReason.PASSWORD_RESET);
  }

  /**
   * Reports whether a refresh token currently identifies an active
   * session, without mutating anything. Deliberately distinct from
   * `#findActiveRefreshToken` (used by `refresh()`), whose replay detection
   * revokes the user's tokens: a passive status check must never revoke
   * anything, or a second tab's mount-time check could log every tab out
   * after the first tab's legitimate refresh.
   * @param {string} [refreshToken] - The refresh token presented by the client (absent: no lookup).
   * @returns {Promise<{ loggedIn: boolean; isAdmin: boolean }>} `{ loggedIn:
   *   true, isAdmin }` (resolved from the token's user) when active; `{
   *   loggedIn: false, isAdmin: false }` otherwise, with no extra query.
   */
  async status(refreshToken?: string): Promise<{ loggedIn: boolean; isAdmin: boolean }> {
    const tokenRow = await this.#findActiveTokenRow(refreshToken);

    if (!tokenRow) {
      return { loggedIn: false, isAdmin: false };
    }

    const user = await this.userRepository.findOneBy({ id: tokenRow.userId });

    return { loggedIn: true, isAdmin: user?.isAdmin ?? false };
  }

  /**
   * Checks that a username/email are available for a user to claim,
   * excluding that user's own row (so "changing" a field to its current
   * value never false-positives). Used by `AccountService`; kept separate
   * from `#assertAvailable` for its distinct error messages.
   * @param {number} excludeUserId - Id of the user updating their account, excluded from the lookup.
   * @param {string} [username] - Candidate username, when being changed.
   * @param {string} [email] - Candidate email, when being changed.
   * @returns {Promise<void>} Resolves once the provided values are confirmed available.
   * @throws {ConflictException} `'Username already in use'` (`USERNAME_TAKEN`) or
   *   `'Email already in use'` (`EMAIL_TAKEN`).
   */
  async assertAvailableForUpdate(
    excludeUserId: number,
    username?: string,
    email?: string,
  ): Promise<void> {
    if (username) {
      await this.#assertFieldAvailable('username', username, excludeUserId, 'Username already in use');
    }

    if (email) {
      await this.#assertFieldAvailable('email', email, excludeUserId, 'Email already in use');
    }
  }

  async #assertAvailable(username: string, email: string): Promise<void> {
    const existing = await this.userRepository.findOne({
      where: [{ username }, { email }],
    });

    if (!existing) {
      return;
    }

    const field = existing.username === username ? 'username' : 'email';
    throw new ConflictException({ code: TAKEN_CODES[field], message: `${field} is not available` });
  }

  async #assertFieldAvailable(
    field: 'username' | 'email',
    value: string,
    excludeUserId: number,
    message: string,
  ): Promise<void> {
    const existing = await this.userRepository.findOne({
      where: { [field]: value, id: Not(excludeUserId) },
    });

    if (existing) {
      throw new ConflictException({ code: TAKEN_CODES[field], message });
    }
  }

  async #findActiveRefreshToken(refreshToken: string): Promise<RefreshToken> {
    const tokenHash = this.tokenService.hashToken(refreshToken);
    const tokenRow = await this.refreshTokenRepository.findOneBy({ tokenHash });

    if (!tokenRow || tokenRow.expiresAt < new Date()) {
      throw new UnauthorizedException('Invalid or expired refresh token');
    }

    if (tokenRow.revokedAt) {
      if (tokenRow.revokedReason === RevokedReason.ROTATED) {
        await this.tokenService.revokeUserTokens(tokenRow.userId, RevokedReason.REPLAY_DETECTED);
      }

      throw new UnauthorizedException('Invalid or expired refresh token');
    }

    return tokenRow;
  }

  async #findActiveTokenRow(refreshToken?: string): Promise<RefreshToken | null> {
    const tokenRow = refreshToken
      ? await this.refreshTokenRepository.findOneBy({ tokenHash: this.tokenService.hashToken(refreshToken) })
      : null;
    const isActive = !!tokenRow && !tokenRow.revokedAt && tokenRow.expiresAt > new Date();

    return isActive ? tokenRow : null;
  }

  async #validateCredentials(username: string, password: string): Promise<User> {
    const user = await this.userRepository.findOneBy({ username });
    const valid = await compareOrDummy(password, user?.passwordDigest);

    if (!user || !valid) {
      throw new UnauthorizedException('Invalid username or password');
    }

    return user;
  }
}
