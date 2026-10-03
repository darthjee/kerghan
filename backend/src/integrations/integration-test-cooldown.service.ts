import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { getNumberConfig } from '../core/numeric-config.js';
import { Integration } from './entities/integration.entity.js';
import { integrationNotFound } from './integration-http-errors.js';

// Default minimum delay between two tests of one integration (30 seconds, in milliseconds).
export const DEFAULT_INTEGRATIONS_TEST_COOLDOWN_MS = 30000;

/** The outcome of a cooldown claim. */
export type CooldownClaim = { claimed: true } | { claimed: false; retryAfterSeconds: number };

/**
 * Per-integration test-connection cooldown, enforced from `last_tested_at`
 * (see `docs/agents/modules/integrations.md#test-connection-cooldown`).
 * The claim is a single conditional `UPDATE`, so parallel tests of one
 * integration make at most one GitHub call per window. The window comes from
 * `KERGHAN_INTEGRATIONS_TEST_COOLDOWN_MS`, read once at construction.
 */
@Injectable()
export class IntegrationTestCooldownService {
  private readonly integrationRepository: Repository<Integration>;
  private readonly cooldownMs: number;

  /**
   * @param {Repository<Integration>} integrationRepository - The integration repository.
   * @param {ConfigService} configService - Supplies the cooldown config key.
   */
  constructor(
    @InjectRepository(Integration) integrationRepository: Repository<Integration>,
      configService: ConfigService,
  ) {
    this.integrationRepository = integrationRepository;
    this.cooldownMs = getNumberConfig(
      configService,
      'KERGHAN_INTEGRATIONS_TEST_COOLDOWN_MS',
      DEFAULT_INTEGRATIONS_TEST_COOLDOWN_MS,
    );
  }

  /**
   * Atomically claims the cooldown window of the caller's integration by
   * setting `last_tested_at = now`, unless it was tested within the window.
   * @param {string} uuid - The integration's uuid.
   * @param {number} userId - The caller's id (the claim is owner-scoped).
   * @param {Date} [now] - The current time.
   * @returns {Promise<CooldownClaim>} Claimed, or the seconds left (rounded up, at least 1).
   */
  async claim(uuid: string, userId: number, now: Date = new Date()): Promise<CooldownClaim> {
    const result = await this.integrationRepository
      .createQueryBuilder()
      .update(Integration)
      .set({ lastTestedAt: now })
      .where('uuid = :uuid AND user_id = :userId', { uuid, userId })
      .andWhere('(last_tested_at IS NULL OR last_tested_at < :threshold)', {
        threshold: new Date(now.getTime() - this.cooldownMs),
      })
      .execute();

    if (result.affected === 1) {
      return { claimed: true };
    }

    return { claimed: false, retryAfterSeconds: await this.remainingSeconds(uuid, userId, now) };
  }

  /**
   * When an integration last tested at `lastTestedAt` may be tested again:
   * `lastTestedAt` plus the cooldown window. It may lie in the past.
   * @param {Date | null} lastTestedAt - The last test time, or `null` if never tested.
   * @returns {Date | null} The end of the cooldown window, or `null` when never tested.
   */
  nextTestAt(lastTestedAt: Date | null): Date | null {
    if (lastTestedAt === null) {
      return null;
    }

    return new Date(new Date(lastTestedAt).getTime() + this.cooldownMs);
  }

  /**
   * Seconds left in the cooldown of a row that couldn't be claimed.
   * @param {string} uuid - The integration's uuid.
   * @param {number} userId - The caller's id.
   * @param {Date} now - The current time.
   * @returns {Promise<number>} The remaining seconds, rounded up and at least 1.
   */
  private async remainingSeconds(uuid: string, userId: number, now: Date): Promise<number> {
    const row = await this.integrationRepository.findOne({
      where: { uuid, userId },
      select: { id: true, lastTestedAt: true },
    });

    if (row === null) {
      throw integrationNotFound();
    }

    // A null `last_tested_at` here means the claim lost a race that has since been undone: retry shortly.
    const remainingMs = row.lastTestedAt === null
      ? 0
      : row.lastTestedAt.getTime() + this.cooldownMs - now.getTime();

    // `last_tested_at` is a seconds-precision `datetime`, so MySQL may round it up by up to a
    // second; never answer more than the window itself.
    const remaining = Math.min(Math.ceil(remainingMs / 1000), Math.ceil(this.cooldownMs / 1000));

    return Math.max(1, remaining);
  }
}
