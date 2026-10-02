import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { getNumberConfig } from '../core/numeric-config.js';
import { IntegrationCredentialLockout } from './entities/integration-credential-lockout.entity.js';

// Default consecutive counted failures that trip the cool-off.
export const DEFAULT_INTEGRATIONS_CREDENTIAL_MAX_ATTEMPTS = 5;
// Default cool-off duration (15 minutes, in milliseconds).
export const DEFAULT_INTEGRATIONS_CREDENTIAL_LOCK_MS = 900000;

// Creates the user's row on first use (a no-op once it exists), so the
// reservation below is always a single-row conditional UPDATE.
export const ENSURE_LOCKOUT_ROW_SQL =
  'INSERT INTO `integrations_credential_lockouts` (`user_id`, `failed_attempts`) VALUES (?, 0) '
  + 'ON DUPLICATE KEY UPDATE `user_id` = `user_id`';

// Atomically reserves one attempt: counts it up front as a (provisional)
// failure and sets the lock in the same statement once the threshold is
// reached, but only while the user is not locked. MySQL evaluates single-table
// UPDATE assignments left to right, so `locked_until` is computed from the
// count *before* the increment. Params: max attempts, lock end, user id, now.
export const RESERVE_ATTEMPT_SQL =
  'UPDATE `integrations_credential_lockouts` '
  + 'SET `locked_until` = IF(`failed_attempts` + 1 >= ?, ?, NULL), `failed_attempts` = `failed_attempts` + 1 '
  + 'WHERE `user_id` = ? AND (`locked_until` IS NULL OR `locked_until` <= ?)';

// Gives back a reservation that did not end in a counted failure. Clearing
// the lock is safe: any lock still present was set by a reservation, and
// without this one the count is back to what it was before it (an expired
// lock with the count at or above the max re-locks on the next failure).
export const RELEASE_ATTEMPT_SQL =
  'UPDATE `integrations_credential_lockouts` '
  + 'SET `failed_attempts` = GREATEST(`failed_attempts` - 1, 0), `locked_until` = NULL '
  + 'WHERE `user_id` = ?';

/**
 * Per-user failure cool-off for creating an integration and replacing its
 * credential (see `docs/agents/specs/integrations/security.md#create-and-replace-credential-failure-cool-off`).
 * Modelled on `AccountEditAbuseGuardService` and `computeLockoutState`, but
 * every counter write is **atomic**: the counter is never read-then-written.
 *
 * Every GitHub validation first **reserves** an attempt (`reserveAttempt`):
 * a conditional UPDATE that counts the attempt as a failure up front and
 * trips the lock as soon as the threshold is reached, proceeding only if one
 * row was affected. A burst of parallel requests therefore makes at most
 * `maxAttempts` GitHub calls. The reservation is then settled: a counted
 * failure keeps it, a success clears the counter (`reset`), and anything else
 * gives it back (`releaseAttempt`).
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
   * Atomically reserves one validation attempt, counted as a failure until
   * settled. Refused while the user is locked out, including when parallel
   * reservations have just reached the threshold.
   * @param {number} userId - The caller's id.
   * @param {Date} [now] - The current time.
   * @returns {Promise<boolean>} `true` when the attempt may call GitHub.
   */
  async reserveAttempt(userId: number, now: Date = new Date()): Promise<boolean> {
    await this.lockoutRepository.query(ENSURE_LOCKOUT_ROW_SQL, [userId]);

    const lockedUntil = new Date(now.getTime() + this.lockMs);
    const result: unknown = await this.lockoutRepository.query(
      RESERVE_ATTEMPT_SQL,
      [this.maxAttempts, lockedUntil, userId, now],
    );

    return affectedRows(result) === 1;
  }

  /**
   * Gives back a reservation that did not end in a counted failure (a
   * transient GitHub failure or an unexpected error).
   * @param {number} userId - The caller's id.
   * @returns {Promise<void>} Resolves once the reservation is released.
   */
  async releaseAttempt(userId: number): Promise<void> {
    await this.lockoutRepository.query(RELEASE_ATTEMPT_SQL, [userId]);
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

/**
 * Reads the affected-row count of a raw MySQL write.
 * @param {unknown} result - The driver's result (a `ResultSetHeader`).
 * @returns {number} The affected rows, `0` when absent.
 */
function affectedRows(result: unknown): number {
  const count = typeof result === 'object' && result !== null
    ? (result as { affectedRows?: unknown }).affectedRows
    : undefined;

  return typeof count === 'number' ? count : 0;
}
