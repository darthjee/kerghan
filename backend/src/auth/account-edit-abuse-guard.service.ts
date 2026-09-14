import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { AccountEditLockout } from './entities/account-edit-lockout.entity.js';

// Default consecutive-failed-attempt threshold, per user, that trips the `PATCH
// /auth/account.json` cool-off, used when `KERGHAN_ACCOUNT_EDIT_MAX_ATTEMPTS` is unset.
const DEFAULT_ACCOUNT_EDIT_MAX_ATTEMPTS = 5;

// Default cool-off duration (5 minutes, in milliseconds) used when
// `KERGHAN_ACCOUNT_EDIT_LOCK_MS` is unset.
const DEFAULT_ACCOUNT_EDIT_LOCK_MS = 300000;

/**
 * Brute-force cool-off lockout for `PATCH /auth/account.json`, mirroring
 * `AuthorizationRequestAbuseGuardService`'s `authorize` cool-off but keyed by `userId` against
 * its own table (`auth_account_edit_lockouts`) rather than a request row, since any failed
 * validation on this endpoint — wrong `currentPassword`, duplicate `username`/`email` — counts
 * toward the same per-user counter. Not exported from `AuthModule` — an internal collaborator
 * only, like `TokenService`. Depends only on injected repositories/services — never reads env
 * vars or global state directly (per `docs/agents/contributing.md`'s DI rule).
 */
@Injectable()
export class AccountEditAbuseGuardService {
  private readonly accountEditLockoutRepository: Repository<AccountEditLockout>;
  private readonly configService: ConfigService;

  /**
   * @param {Repository<AccountEditLockout>} accountEditLockoutRepository - The
   *   account-edit-lockout repository.
   * @param {ConfigService} configService - Supplies the max-attempts/lock-duration config keys.
   */
  constructor(
    @InjectRepository(AccountEditLockout) accountEditLockoutRepository: Repository<AccountEditLockout>,
      configService: ConfigService,
  ) {
    this.accountEditLockoutRepository = accountEditLockoutRepository;
    this.configService = configService;
  }

  /**
   * Reports whether `userId` is currently within its `PATCH /auth/account.json` cool-off lockout
   * window. A user with no lockout row yet is never locked out.
   * @param {number} userId - The authenticated user's ID.
   * @returns {Promise<boolean>} Whether the user's `lockedUntil` is set and still in the future.
   */
  async isLockedOut(userId: number): Promise<boolean> {
    const lockout = await this.accountEditLockoutRepository.findOne({ where: { userId } });

    return lockout !== null && lockout.lockedUntil !== null && lockout.lockedUntil > new Date();
  }

  /**
   * Records one more failed `PATCH /auth/account.json` attempt for `userId`, creating the
   * user's lockout row on the first failure, and locking it (setting `lockedUntil`) once the
   * configured max-attempts threshold is reached.
   * @param {number} userId - The authenticated user's ID.
   * @returns {Promise<void>} Resolves once the user's attempt counter (and lock, if tripped) is persisted.
   */
  async registerFailure(userId: number): Promise<void> {
    const lockout = await this.accountEditLockoutRepository.findOne({ where: { userId } });
    const attempts = (lockout?.failedAttempts ?? 0) + 1;
    const lockedUntil = attempts >= this.#maxAttempts() ? new Date(Date.now() + this.#lockMs()) : null;

    if (lockout) {
      await this.accountEditLockoutRepository.update(lockout.id, { failedAttempts: attempts, lockedUntil });
    } else {
      await this.accountEditLockoutRepository.save(
        this.accountEditLockoutRepository.create({ userId, failedAttempts: attempts, lockedUntil }),
      );
    }
  }

  /**
   * Clears `userId`'s failed-attempts counter and lock, called after a successful account
   * update. A no-op when the user has no lockout row.
   * @param {number} userId - The authenticated user's ID.
   * @returns {Promise<void>} Resolves once the reset (if any) is persisted.
   */
  async reset(userId: number): Promise<void> {
    const lockout = await this.accountEditLockoutRepository.findOne({ where: { userId } });

    if (lockout) {
      await this.accountEditLockoutRepository.update(lockout.id, { failedAttempts: 0, lockedUntil: null });
    }
  }

  #maxAttempts(): number {
    return Number(this.configService.get('KERGHAN_ACCOUNT_EDIT_MAX_ATTEMPTS') ?? DEFAULT_ACCOUNT_EDIT_MAX_ATTEMPTS);
  }

  #lockMs(): number {
    return Number(this.configService.get('KERGHAN_ACCOUNT_EDIT_LOCK_MS') ?? DEFAULT_ACCOUNT_EDIT_LOCK_MS);
  }
}
