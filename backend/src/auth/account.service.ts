import { BadRequestException, Injectable, UnauthorizedException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import bcrypt from 'bcryptjs';
import { Repository } from 'typeorm';
import { AuthService } from './auth.service.js';
import { UpdateAccountDto } from './dto/update-account.dto.js';
import { User } from './entities/user.entity.js';

/** The `{username, email}` shape returned to the caller after an account update. */
export interface AccountSummary {
  username: string;
  email: string;
}

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

  /**
   * @param {Repository<User>} userRepository - The Auth module's user repository.
   * @param {AuthService} authService - Supplies the self-exclusion
   *   username/email availability check for updates.
   */
  constructor(
    @InjectRepository(User) userRepository: Repository<User>,
      authService: AuthService,
  ) {
    this.userRepository = userRepository;
    this.authService = authService;
  }

  /**
   * Updates the caller's own username, email, and/or password, always
   * confirmed by their current password. Leaves other active sessions
   * (refresh tokens) untouched — deliberately, per the issue's Expected
   * Behavior — unlike the password-recovery reset flow.
   * @param {number} userId - The id of the authenticated user (from the access-token session).
   * @param {UpdateAccountDto} dto - The requested changes plus the current password.
   * @returns {Promise<AccountSummary>} The user's resulting username and email.
   * @throws {BadRequestException} When no field is being changed, the
   *   current password is wrong, or the new username/email is already taken.
   */
  async updateAccount(userId: number, dto: UpdateAccountDto): Promise<AccountSummary> {
    this.#assertAnyFieldPresent(dto);

    const user = await this.#loadUser(userId);
    await this.#verifyCurrentPassword(user, dto.currentPassword);
    await this.#assertNewValuesAvailable(user, dto);

    return this.#applyUpdates(user, dto);
  }

  async #applyUpdates(user: User, dto: UpdateAccountDto): Promise<AccountSummary> {
    if (dto.username) {
      user.username = dto.username;
    }

    if (dto.email) {
      user.email = dto.email;
    }

    if (dto.newPassword) {
      user.passwordDigest = await bcrypt.hash(dto.newPassword, 10);
    }

    const saved = await this.userRepository.save(user);

    return { username: saved.username, email: saved.email };
  }

  #assertAnyFieldPresent(dto: UpdateAccountDto): void {
    if (!dto.username && !dto.email && !dto.newPassword) {
      throw new BadRequestException('At least one of username, email, or newPassword is required');
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
