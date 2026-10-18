import { ConflictException, Injectable, OnApplicationBootstrap } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import bcrypt from 'bcryptjs';
import { QueryFailedError, Repository } from 'typeorm';
import { DefaultUserConfig } from './default-user.config.js';
import { ErrorCodes } from '../core/error-codes.js';
import { LoggerService } from '../core/logger.service.js';
import { RevokedReason } from './entities/refresh-token.entity.js';
import { User, UserStatus } from './entities/user.entity.js';
import { TokenService, type AuthResult } from './token.service.js';

/**
 * The message of every `409 DEFAULT_USER_MANAGED` response (see
 * `docs/agents/specs/default-user/edit-blocking.md`). Shared by every call
 * site and spec so the text cannot drift.
 */
export const DEFAULT_USER_MANAGED_MESSAGE =
  'This user is managed by environment configuration and cannot be edited';

// MySQL's driver error code for a unique-index violation, used to detect the
// concurrent-boot insert race without depending on the message text.
const MYSQL_DUPLICATE_ENTRY_CODE = 'ER_DUP_ENTRY';

// The boot warning logged while automatic login is on (see
// `docs/agents/specs/default-user/automatic-login.md#boot-warning`).
export const AUTOMATIC_LOGIN_WARNING =
  'AUTOMATIC LOGIN IS ON: status.json logs callers in as the default user';

/**
 * Synchronizes the default user (`KERGHAN_DEFAULT_USER_*`, read through
 * {@link DefaultUserConfig}) at application boot, and is the single place
 * that knows which row is the default user. Boot sync records the **id** of
 * the row it created or matched; edits are blocked by comparing ids, never
 * usernames (`auth_users.username` uses MySQL's case/accent-insensitive
 * collation). While the feature is disabled nothing happens at boot, no id
 * is held and nothing is blocked. Not exported from `AuthModule` — an
 * internal collaborator only. Depends only on injected repositories and
 * services (per `docs/agents/contributing.md`'s DI rule).
 */
@Injectable()
export class DefaultUserService implements OnApplicationBootstrap {
  private readonly userRepository: Repository<User>;
  private readonly config: DefaultUserConfig;
  private readonly tokenService: TokenService;
  private readonly logger: LoggerService;
  #defaultUserId: number | null = null;

  /**
   * @param {Repository<User>} userRepository - The user repository.
   * @param {DefaultUserConfig} config - The validated default-user configuration.
   * @param {TokenService} tokenService - Revokes the default user's sessions
   *   when boot sync changes its password.
   * @param {LoggerService} logger - The injected Core logger.
   */
  constructor(
    @InjectRepository(User) userRepository: Repository<User>,
      config: DefaultUserConfig,
      tokenService: TokenService,
      logger: LoggerService,
  ) {
    this.userRepository = userRepository;
    this.config = config;
    this.tokenService = tokenService;
    this.logger = logger;
  }

  /**
   * Nest lifecycle hook: when the feature is enabled, creates or updates the
   * default user to match the configuration and records its id. The
   * default user is always `approved` (a pending or denied one is approved
   * again, without revoking its sessions). A no-op when disabled.
   * @returns {Promise<void>} Resolves once the default user is synchronized.
   * @throws {Error} When the configured email belongs to another user,
   *   aborting boot.
   */
  async onApplicationBootstrap(): Promise<void> {
    if (!this.config.isEnabled()) {
      return;
    }

    const user = await this.#sync();

    this.#defaultUserId = user.id;
    this.logger.info('default user synchronized', { context: 'DefaultUserService', userId: user.id });
    this.#warnIfAutomaticLogin();
  }

  /**
   * Logs the caller in as the default user (`status.json`'s automatic
   * login): mints a regular session (`keepSignedIn: false`, regular refresh
   * TTL) through the same {@link TokenService#issueTokens} path
   * `login.json` uses, without any password check.
   * @param {string} clientIp - The resolved client IP (trusted proxy hops
   *   already applied).
   * @returns {Promise<AuthResult | null>} The new session, or `null` when
   *   always-authenticated is off, boot sync recorded no id, the IP is not
   *   allowed (an empty IP never is) or the default user row is gone.
   */
  async autoLogin(clientIp: string): Promise<AuthResult | null> {
    if (!this.#canAutoLogin(clientIp)) {
      return null;
    }

    const user = await this.userRepository.findOneBy({ id: this.#defaultUserId as number });

    return user ? this.tokenService.issueTokens(user, false) : null;
  }

  /**
   * @param {number} userId - The user ID to check.
   * @returns {boolean} `true` only when the feature is enabled, boot sync
   *   recorded an id, and it equals `userId`.
   */
  isDefaultUser(userId: number): boolean {
    return this.config.isEnabled() && this.#defaultUserId !== null && this.#defaultUserId === userId;
  }

  /**
   * Refuses a write of a managed field of the default user.
   * @param {number} userId - The ID of the user the write targets.
   * @returns {void} Returns normally when `userId` is not the default user.
   * @throws {ConflictException} `409 DEFAULT_USER_MANAGED` when `userId` is
   *   the default user.
   */
  assertNotDefaultUser(userId: number): void {
    if (this.isDefaultUser(userId)) {
      throw new ConflictException({
        code: ErrorCodes.DEFAULT_USER_MANAGED,
        message: DEFAULT_USER_MANAGED_MESSAGE,
      });
    }
  }

  #canAutoLogin(clientIp: string): boolean {
    return this.config.isAlwaysAuthenticated()
      && this.#defaultUserId !== null
      && clientIp !== ''
      && this.config.isIpAllowed(clientIp);
  }

  #warnIfAutomaticLogin(): void {
    if (!this.config.isAlwaysAuthenticated()) {
      return;
    }

    this.logger.warn(AUTOMATIC_LOGIN_WARNING, {
      context: 'DefaultUserService',
      username: this.config.username(),
      allowedIps: this.config.allowedIps(),
    });
  }

  async #sync(): Promise<User> {
    const existing = await this.userRepository.findOneBy({ username: this.config.username() });

    await this.#assertEmailAvailable(existing);

    return existing ? this.#update(existing) : this.#createOrUpdate();
  }

  async #assertEmailAvailable(matched: User | null): Promise<void> {
    const owner = await this.userRepository.findOneBy({ email: this.config.email() });

    if (owner && owner.id !== matched?.id) {
      throw new Error(
        'default-user: the default user email already belongs to another user '
        + `(configured username "${this.config.username()}", owner id ${owner.id})`,
      );
    }
  }

  async #createOrUpdate(): Promise<User> {
    try {
      return await this.userRepository.save(
        this.userRepository.create({
          username: this.config.username(),
          email: this.config.email(),
          passwordDigest: await bcrypt.hash(this.config.password(), 10),
          isAdmin: this.config.isAdmin(),
          status: UserStatus.APPROVED,
        }),
      );
    } catch (error) {
      return this.#recoverFromInsertRace(error);
    }
  }

  async #recoverFromInsertRace(error: unknown): Promise<User> {
    if (!isDuplicateEntryError(error)) {
      throw error;
    }

    const existing = await this.userRepository.findOneBy({ username: this.config.username() });

    if (!existing) {
      throw error;
    }

    await this.#assertEmailAvailable(existing);

    return this.#update(existing);
  }

  async #update(user: User): Promise<User> {
    const passwordChanged = !(await bcrypt.compare(this.config.password(), user.passwordDigest));

    user.email = this.config.email();
    user.isAdmin = this.config.isAdmin();
    user.status = UserStatus.APPROVED;

    if (passwordChanged) {
      user.passwordDigest = await bcrypt.hash(this.config.password(), 10);
    }

    await this.userRepository.save(user);

    if (passwordChanged) {
      await this.tokenService.revokeUserTokens(user.id, RevokedReason.ADMIN_PASSWORD_CHANGE);
    }

    return user;
  }
}

/**
 * @param {unknown} error - The error thrown by an insert.
 * @returns {boolean} Whether it is MySQL's unique-index violation.
 */
function isDuplicateEntryError(error: unknown): boolean {
  if (!(error instanceof QueryFailedError)) {
    return false;
  }

  const driverError: unknown = error.driverError;

  return (
    typeof driverError === 'object'
    && driverError !== null
    && 'code' in driverError
    && driverError.code === MYSQL_DUPLICATE_ENTRY_CODE
  );
}
