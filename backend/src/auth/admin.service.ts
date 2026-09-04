import { Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { ILike, Repository } from 'typeorm';
import { User } from './entities/user.entity.js';
import { buildPasswordRecoveryEmail } from './events/password-recovery-email.content.js';
import { PasswordResetService } from './password-reset.service.js';
import { MailService } from '../mail/mail.service.js';

/**
 * The admin tool's business logic: user lookup, and admin-triggered
 * password-recovery-link generation/emailing — reusing `PasswordResetService
 * #issueToken` and `MailService` (from #36/#38/#39) rather than introducing
 * new machinery. Lives inside the `auth` module (not a separate `admin`
 * module) since it only ever reads/writes `User`/`PasswordResetToken`, both
 * owned by `auth` — see `docs/agents/architecture/modular-pattern.md`'s rule
 * that a module never writes to another module's tables.
 */
@Injectable()
export class AdminService {
  private readonly userRepository: Repository<User>;
  private readonly passwordResetService: PasswordResetService;
  private readonly mailService: MailService;

  /**
   * @param {Repository<User>} userRepository - The Auth module's user repository.
   * @param {PasswordResetService} passwordResetService - Mints password-reset
   *   tokens via its shared `issueToken` method.
   * @param {MailService} mailService - The Mail module's send pipe (direct DI).
   */
  constructor(
    @InjectRepository(User) userRepository: Repository<User>,
      passwordResetService: PasswordResetService,
      mailService: MailService,
  ) {
    this.userRepository = userRepository;
    this.passwordResetService = passwordResetService;
    this.mailService = mailService;
  }

  /**
   * Looks up accounts, optionally filtered by a search term.
   * @param {string} [q] - When present, matches case-insensitively against
   *   `username` or `email`; when absent, every account is returned (no
   *   pagination, per #41's scope).
   * @returns {Promise<User[]>} The matching users, `passwordDigest` included
   *   (serialization to the public shape happens in the controller).
   */
  async searchUsers(q?: string): Promise<User[]> {
    if (!q) {
      return this.userRepository.find();
    }

    return this.userRepository.find({
      where: [{ username: ILike(`%${q}%`) }, { email: ILike(`%${q}%`) }],
    });
  }

  /**
   * Mints a fresh password-recovery link for a user, without invalidating
   * their other outstanding tokens (matching self-service semantics).
   * @param {number} userId - The id of the user to mint a link for.
   * @returns {Promise<{ resetUrl: string }>} The freshly minted recovery URL.
   * @throws {NotFoundException} When no user matches `userId`.
   */
  async generateRecoveryLink(userId: number): Promise<{ resetUrl: string }> {
    const user = await this.#findUserOrThrow(userId);
    const { resetUrl } = await this.passwordResetService.issueToken(user);

    return { resetUrl };
  }

  /**
   * Mints a fresh password-recovery link the same way as
   * {@link generateRecoveryLink}, then sends it to the user directly and
   * synchronously (not the fire-and-forget event path self-service uses),
   * so the caller gets a real success/failure result.
   * @param {number} userId - The id of the user to send a recovery email to.
   * @returns {Promise<{ sent: boolean }>} `{ sent: true }` when the mail
   *   transport accepted the message, `{ sent: false }` when email is
   *   disabled or the send failed.
   * @throws {NotFoundException} When no user matches `userId`.
   */
  async sendRecoveryEmail(userId: number): Promise<{ sent: boolean }> {
    const user = await this.#findUserOrThrow(userId);
    const { resetUrl } = await this.passwordResetService.issueToken(user);
    const { subject, text } = buildPasswordRecoveryEmail(resetUrl);

    try {
      const result = await this.mailService.send({ to: user.email, subject, text });

      return { sent: result.status === 'sent' };
    } catch {
      return { sent: false };
    }
  }

  async #findUserOrThrow(id: number): Promise<User> {
    const user = await this.userRepository.findOneBy({ id });

    if (!user) {
      throw new NotFoundException('User not found');
    }

    return user;
  }
}
