import { BadRequestException, Injectable, UnauthorizedException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import bcrypt from 'bcryptjs';
import { Repository } from 'typeorm';
import { AccountEditAbuseGuardService } from './account-edit-abuse-guard.service.js';
import { assertAnyFieldPresent, hasManagedField } from './assert-any-field-present.js';
import { AuthService } from './auth.service.js';
import { DefaultUserService } from './default-user.service.js';
import { UpdateAccountDto } from './dto/update-account.dto.js';
import { RevokedReason } from './entities/refresh-token.entity.js';
import { User } from './entities/user.entity.js';
import { TokenService } from './token.service.js';
import { AccountSummary, UserUpdateService } from './user-update.service.js';
import { LockedException } from '../core/locked.exception.js';

/**
 * The self-service "My Account" update flow's business logic (`PATCH
 * /auth/account.json`), split into its own service rather than growing
 * `AuthService` further (already near the project's 300-line-per-file
 * convention — see `docs/agents/plans/.../backend.md`'s Notes).
 */
@Injectable()
export class AccountService {
  private readonly userRepository: Repository<User>;
  private readonly authService: AuthService;
  private readonly userUpdateService: UserUpdateService;
  private readonly accountEditAbuseGuardService: AccountEditAbuseGuardService;
  private readonly tokenService: TokenService;
  private readonly defaultUserService: DefaultUserService;

  /**
   * @param {Repository<User>} userRepository - The Auth module's user repository.
   * @param {AuthService} authService - Supplies the self-exclusion
   *   username/email availability check for updates.
   * @param {UserUpdateService} userUpdateService - Applies/hashes/persists
   *   the requested changes, shared with `AdminService#editUser`.
   * @param {AccountEditAbuseGuardService} accountEditAbuseGuardService - Tracks and enforces
   *   the per-user brute-force cool-off lockout for this endpoint.
   * @param {TokenService} tokenService - Revokes the caller's other refresh
   *   tokens after a successful password change.
   * @param {DefaultUserService} defaultUserService - Refuses edits of the
   *   default user's managed fields.
   */
  constructor(
    @InjectRepository(User) userRepository: Repository<User>,
      authService: AuthService,
      userUpdateService: UserUpdateService,
      accountEditAbuseGuardService: AccountEditAbuseGuardService,
      tokenService: TokenService,
      defaultUserService: DefaultUserService,
  ) {
    this.userRepository = userRepository;
    this.authService = authService;
    this.userUpdateService = userUpdateService;
    this.accountEditAbuseGuardService = accountEditAbuseGuardService;
    this.tokenService = tokenService;
    this.defaultUserService = defaultUserService;
  }

  /**
   * Updates the caller's own username, email, and/or password, always
   * confirmed by their current password. A successful password change
   * revokes the caller's other refresh tokens, keeping the presented
   * `currentRefreshToken` only when it is one of the caller's active tokens —
   * otherwise (missing, unknown, foreign) all of them are revoked (fail
   * safe). Username/email-only changes revoke nothing, and a failed attempt
   * never revokes anything. Any failed
   * validation (wrong current password, duplicate username/email) counts
   * toward a per-user cool-off lockout, checked before any other validation
   * runs and reset on success (see `AccountEditAbuseGuardService`). While
   * the default user is enabled, a request carrying a managed field for the
   * default user is refused right after the "any field" check — before the
   * lockout check, never checking `currentPassword` and never touching the
   * abuse-guard counter.
   * @param {number} userId - The id of the authenticated user (from the access-token session).
   * @param {UpdateAccountDto} dto - The requested changes plus the current password.
   * @param {string} [currentRefreshToken] - The caller's refresh token (from
   *   the `refresh_token` cookie), identifying the session to keep on a
   *   password change.
   * @returns {Promise<AccountSummary>} The user's resulting username and email.
   * @throws {BadRequestException} When no field is being changed or the
   *   current password is wrong.
   * @throws {ConflictException} When the new username/email is already taken,
   *   or `409 DEFAULT_USER_MANAGED` when the caller is the default user.
   * @throws {LockedException} `423 Locked` when the caller's per-user cool-off
   *   lockout is currently active.
   */
  async updateAccount(userId: number, dto: UpdateAccountDto, currentRefreshToken?: string): Promise<AccountSummary> {
    assertAnyFieldPresent(dto);
    this.#assertNotManaged(userId, dto);
    await this.#assertNotLockedOut(userId);

    const user = await this.#loadUser(userId);
    await this.#applyGuardedChecks(user, dto);

    const result = await this.userUpdateService.applyUserUpdate(user, dto);
    await this.accountEditAbuseGuardService.reset(userId);

    if (dto.newPassword) {
      await this.tokenService.revokeUserTokens(userId, RevokedReason.PASSWORD_CHANGE, currentRefreshToken);
    }

    return result;
  }

  #assertNotManaged(userId: number, dto: UpdateAccountDto): void {
    if (hasManagedField(dto)) {
      this.defaultUserService.assertNotDefaultUser(userId);
    }
  }

  async #assertNotLockedOut(userId: number): Promise<void> {
    if (await this.accountEditAbuseGuardService.isLockedOut(userId)) {
      throw new LockedException('Account temporarily locked due to too many failed attempts');
    }
  }

  async #applyGuardedChecks(user: User, dto: UpdateAccountDto): Promise<void> {
    try {
      await this.#verifyCurrentPassword(user, dto.currentPassword);
      await this.#assertNewValuesAvailable(user, dto);
    } catch (error) {
      await this.accountEditAbuseGuardService.registerFailure(user.id);
      throw error;
    }
  }

  async #assertNewValuesAvailable(user: User, dto: UpdateAccountDto): Promise<void> {
    const username = dto.username && dto.username !== user.username ? dto.username : undefined;
    const email = dto.email && dto.email !== user.email ? dto.email : undefined;

    await this.authService.assertAvailableForUpdate(user.id, username, email);
  }

  async #loadUser(userId: number): Promise<User> {
    const user = await this.userRepository.findOneBy({ id: userId });

    if (!user) {
      throw new UnauthorizedException('Invalid session');
    }

    return user;
  }

  async #verifyCurrentPassword(user: User, currentPassword: string): Promise<void> {
    const valid = await bcrypt.compare(currentPassword, user.passwordDigest);

    if (!valid) {
      throw new BadRequestException('Invalid current password');
    }
  }
}
