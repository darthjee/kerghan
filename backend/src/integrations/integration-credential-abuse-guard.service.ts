import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { InjectRepository } from '@nestjs/typeorm';
import { MoreThanOrEqual, Repository } from 'typeorm';
import { computeLockoutState } from '../core/lockout-state.js';
import { getNumberConfig } from '../core/numeric-config.js';
import { IntegrationCredentialLockout } from './entities/integration-credential-lockout.entity.js';

// Default consecutive counted failures that trip the cool-off.
export const DEFAULT_INTEGRATIONS_CREDENTIAL_MAX_ATTEMPTS = 5;
// Default cool-off duration (15 minutes, in milliseconds).
export const DEFAULT_INTEGRATIONS_CREDENTIAL_LOCK_MS = 900000;

// Atomic first-failure upsert / increment, keyed on the unique `user_id`.
export const REGISTER_FAILURE_SQL =
  'INSERT INTO `integrations_credential_lockouts` (`user_id`, `failed_attempts`) VALUES (?, 1) '
  + 'ON DUPLICATE KEY UPDATE `failed_attempts` = `failed_attempts` + 1';

/**
 * Per-user failure cool-off for creating an integration and replacing its
 * credential (see `docs/agents/specs/integrations/security.md#create-and-replace-credential-failure-cool-off`).
 * Modelled on `AccountEditAbuseGuardService` and `computeLockoutState`, but
 * every counter write is **atomic**: the counter is never read-then-written,
 * so parallel failures all count.
 *
 * Expiry semantics follow `computeLockoutState`: once `locked_until` has
 * passed the counter is not reset, so the next counted failure starts from
 * the stored count and re-locks immediately; only a successful validation
 * (`reset`) clears it.
 *
 * The limits come from `KERGHAN_INTEGRATIONS_CREDENTIAL_MAX_ATTEMPTS` and
 * `KERGHAN_INTEGRATIONS_CREDENTIAL_LOCK_MS`, read once at construction.
 */
@Injectable()
export class IntegrationCredentialAbuseGuardService {
  private readonly lockoutRepository: Repository<IntegrationCredentialLockout>;
  private readonly maxAttempts: number;
  private readonly lockMs: number;

  /**
   * @param {Repository<IntegrationCredentialLockout>} lockoutRepository - The lockout repository.
   * @param {ConfigService} configService - Supplies the max-attempts/lock-duration config keys.
   */
  constructor(
    @InjectRepository(IntegrationCredentialLockout) lockoutRepository: Repository<IntegrationCredentialLockout>,
      configService: ConfigService,
  ) {
    this.lockoutRepository = lockoutRepository;
    this.maxAttempts = getNumberConfig(
      configService,
      'KERGHAN_INTEGRATIONS_CREDENTIAL_MAX_ATTEMPTS',
      DEFAULT_INTEGRATIONS_CREDENTIAL_MAX_ATTEMPTS,
    );
    this.lockMs = getNumberConfig(
      configService,
      'KERGHAN_INTEGRATIONS_CREDENTIAL_LOCK_MS',
      DEFAULT_INTEGRATIONS_CREDENTIAL_LOCK_MS,
    );
  }

  /**
   * Whether the user is within an active cool-off.
   * @param {number} userId - The caller's id.
   * @returns {Promise<boolean>} `true` when `locked_until` is set and in the future.
   */
  async isLockedOut(userId: number): Promise<boolean> {
    const lockout = await this.lockoutRepository.findOne({ where: { userId } });

    return lockout !== null && lockout.lockedUntil !== null && lockout.lockedUntil > new Date();
  }

  /**
   * Counts one more failure: an atomic upsert-increment, a re-read, and a
   * conditional `UPDATE` setting `locked_until` once the threshold is reached.
   * @param {number} userId - The caller's id.
   * @returns {Promise<void>} Resolves once the failure (and lock, if tripped) is persisted.
   */
  async registerFailure(userId: number): Promise<void> {
    await this.lockoutRepository.query(REGISTER_FAILURE_SQL, [userId]);

    const lockout = await this.lockoutRepository.findOne({ where: { userId } });

    if (lockout === null) {
      return;
    }

    const { lockedUntil } = computeLockoutState(lockout.failedAttempts - 1, this.maxAttempts, this.lockMs);

    if (lockedUntil !== null) {
      await this.lockoutRepository.update(
        { userId, failedAttempts: MoreThanOrEqual(this.maxAttempts) },
        { lockedUntil },
      );
    }
  }

  /**
   * Clears the counter and lock after a successful validation (no-op without a row).
   * @param {number} userId - The caller's id.
   * @returns {Promise<void>} Resolves once the reset is persisted.
   */
  async reset(userId: number): Promise<void> {
    await this.lockoutRepository.update({ userId }, { failedAttempts: 0, lockedUntil: null });
  }
}
