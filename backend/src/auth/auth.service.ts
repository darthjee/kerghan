import { ForbiddenException, Injectable, UnauthorizedException } from '@nestjs/common';
import { EventEmitter2 } from '@nestjs/event-emitter';
import { InjectRepository } from '@nestjs/typeorm';
import bcrypt from 'bcryptjs';
import { IsNull, Repository } from 'typeorm';
import { DefaultUserService } from './default-user.service.js';
import { ErrorCodes } from '../core/error-codes.js';
import { LoginDto } from './dto/login.dto.js';
import { RecoverDto } from './dto/recover.dto.js';
import { RegisterDto } from './dto/register.dto.js';
import { ResetPasswordDto } from './dto/reset-password.dto.js';
import { compareOrDummy } from './dummy-digest.js';
import { RefreshToken, RevokedReason } from './entities/refresh-token.entity.js';
import { User, UserStatus } from './entities/user.entity.js';
import { UserRegisteredEvent } from './events/user-registered.event.js';
import { PasswordResetService } from './password-reset.service.js';
import { TokenService, type AuthResult, type StatusResult } from './token.service.js';
import { UserApprovalConfig } from './user-approval.config.js';
import { assertAvailable, assertFieldAvailable } from './user-availability.js';

export type { AuthResult, StatusResult };

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
  private readonly defaultUserService: DefaultUserService;
  private readonly userApprovalConfig: UserApprovalConfig;

  /**
   * @param {Repository<User>} userRepository - The Auth module's user repository.
   * @param {Repository<RefreshToken>} refreshTokenRepository - The refresh-token repository.
   * @param {TokenService} tokenService - Mints login sessions and hashes refresh tokens.
   * @param {EventEmitter2} eventEmitter - Fires the `user.registered` event.
   * @param {PasswordResetService} passwordResetService - Recovery/reset logic (`recover`/`resetPassword`).
   * @param {DefaultUserService} defaultUserService - `status()`'s automatic login as the default user.
   * @param {UserApprovalConfig} userApprovalConfig - Decides the status of new registrations.
   */
  constructor(
    @InjectRepository(User) userRepository: Repository<User>,
    @InjectRepository(RefreshToken) refreshTokenRepository: Repository<RefreshToken>,
      tokenService: TokenService,
      eventEmitter: EventEmitter2,
      passwordResetService: PasswordResetService,
      defaultUserService: DefaultUserService,
      userApprovalConfig: UserApprovalConfig,
  ) {
    this.userRepository = userRepository;
    this.refreshTokenRepository = refreshTokenRepository;
    this.tokenService = tokenService;
    this.eventEmitter = eventEmitter;
    this.passwordResetService = passwordResetService;
    this.defaultUserService = defaultUserService;
    this.userApprovalConfig = userApprovalConfig;
  }

  /**
   * Registers a new user and immediately logs them in (issues tokens),
   * per the issue's JWT flow ("issued on login/register/refresh"). The user
   * is created `pending` when `KERGHAN_USER_APPROVAL_REQUIRED` is on,
   * `approved` otherwise; the session is minted either way (a pending
   * session is blocked by the gate until an admin approves).
   * @param {RegisterDto} dto - The registration payload.
   * @returns {Promise<AuthResult>} The created user plus access/refresh tokens.
   * @throws {ConflictException} When the username/email are already taken (`USERNAME_TAKEN`/`EMAIL_TAKEN`).
   */
  async register(dto: RegisterDto): Promise<AuthResult> {
    await assertAvailable(this.userRepository, dto.username, dto.email);

    const passwordDigest = await bcrypt.hash(dto.password, 10);
    const user = await this.userRepository.save(
      this.userRepository.create({
        username: dto.username,
        email: dto.email,
        passwordDigest,
        isAdmin: false,
        status: this.userApprovalConfig.registrationStatus(),
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
   * A `pending` user gets a session like anyone else (the gate blocks it);
   * a `denied` user with the right password gets `403 USER_DENIED` and no
   * tokens — only after the password check, so a wrong password is the same
   * `401` whatever the status.
   * @returns {Promise<AuthResult>} The authenticated user plus access/refresh tokens.
   * @throws {UnauthorizedException} When the username is unknown or the password is wrong.
   * @throws {ForbiddenException} When the credentials are right but the user is `denied` (`USER_DENIED`).
   */
  async login(dto: LoginDto): Promise<AuthResult> {
    const user = await this.#validateCredentials(dto.username, dto.password);

    if (user.status === UserStatus.DENIED) {
      throw new ForbiddenException({ code: ErrorCodes.USER_DENIED, message: 'This account has been denied access' });
    }

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
   * revocation or refresh is a plain 401 with no tokens issued. A `denied`
   * user's active token is revoked (`admin_denied`) and answered with the
   * same plain 401 (after replay detection, which stays first); a `pending`
   * user's token rotates as usual.
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

    if (user.status === UserStatus.DENIED) {
      await this.tokenService.revokeToken(tokenRow.id, RevokedReason.ADMIN_DENIED);

      throw new UnauthorizedException('Invalid or expired refresh token');
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
   * Reports whether a refresh token identifies an active session (see
   * `TokenService#findActiveToken`). A `denied` user's token is revoked
   * (`admin_denied`, the only write) and treated as no session; with no
   * session, tries the automatic login (`DefaultUserService#autoLogin`).
   * @param {string} [refreshToken] - The refresh token presented by the client (absent: no lookup).
   * @param {string} [clientIp] - The resolved client IP, checked against the default-user allowlist.
   * @returns {Promise<StatusResult>} `{ loggedIn: true, isAdmin }` from the
   *   token's user when active; `{ loggedIn: true, isAdmin, session }` on an
   *   automatic login; `{ loggedIn: false, isAdmin: false, status: 'pending' }`
   *   for a pending user; `{ loggedIn: false, isAdmin: false }` otherwise.
   */
  async status(refreshToken?: string, clientIp = ''): Promise<StatusResult> {
    const tokenRow = await this.tokenService.findActiveToken(refreshToken);
    const user = tokenRow ? await this.userRepository.findOneBy({ id: tokenRow.userId }) : null;

    if (tokenRow && user?.status === UserStatus.DENIED) {
      await this.tokenService.revokeToken(tokenRow.id, RevokedReason.ADMIN_DENIED);
    } else if (tokenRow && user?.status === UserStatus.PENDING) {
      return { loggedIn: false, isAdmin: false, status: UserStatus.PENDING };
    } else if (tokenRow) {
      return { loggedIn: true, isAdmin: user?.isAdmin ?? false };
    }

    const session = await this.defaultUserService.autoLogin(clientIp);

    return session
      ? { loggedIn: true, isAdmin: session.user.isAdmin, session }
      : { loggedIn: false, isAdmin: false };
  }

  /**
   * Checks that a username/email are available for a user to claim,
   * excluding that user's own row (so "changing" a field to its current
   * value never false-positives). Used by `AccountService`/`AdminService`;
   * kept separate from registration's check for its distinct error messages.
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
      await assertFieldAvailable(this.userRepository, 'username', username, excludeUserId, 'Username already in use');
    }

    if (email) {
      await assertFieldAvailable(this.userRepository, 'email', email, excludeUserId, 'Email already in use');
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

  async #validateCredentials(username: string, password: string): Promise<User> {
    const user = await this.userRepository.findOneBy({ username });
    const valid = await compareOrDummy(password, user?.passwordDigest);

    if (!user || !valid) {
      throw new UnauthorizedException('Invalid username or password');
    }

    return user;
  }
}
