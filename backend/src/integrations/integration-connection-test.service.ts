import { Injectable } from '@nestjs/common';
import { LoggerService } from '../core/logger.service.js';
import type { Integration } from './entities/integration.entity.js';
import { githubRateLimited, githubUnavailable, testCooldown } from './integration-http-errors.js';
import { toIntegrationView } from './integration-response.js';
import { IntegrationStoreService } from './integration-store.service.js';
import { IntegrationTestCooldownService } from './integration-test-cooldown.service.js';
import { type EncryptedSecret, IntegrationsEncryptionService, type SecretBinding } from './integrations-encryption.service.js';
import type { Secret } from './secret.js';
import { IntegrationTypeRegistry } from './types/integration-type-registry.js';
import type { IntegrationTypeStrategy, TestOutcome } from './types/integration-type-strategy.js';

/**
 * Test connection (see `docs/agents/backend/routes/integrations.md#per-action-behaviour`):
 * owner lookup → atomic cooldown claim → decrypt → the type's `test` →
 * record `last_tested_at` / `last_test_result`. A rejection is a successful
 * test (200); a transient failure leaves the status unchanged and answers
 * 502/503; a row that can't be decrypted becomes `undecryptable` without a
 * GitHub call. A row decrypted under a previous key is lazily re-encrypted
 * under the current key (whatever the GitHub outcome), through a write
 * conditioned on the old key id so a concurrent replacement wins.
 */
@Injectable()
export class IntegrationConnectionTestService {
  private readonly store: IntegrationStoreService;
  private readonly cooldown: IntegrationTestCooldownService;
  private readonly encryption: IntegrationsEncryptionService;
  private readonly registry: IntegrationTypeRegistry;
  private readonly logger: LoggerService;

  /**
   * @param {IntegrationStoreService} store - Owner-scoped persistence.
   * @param {IntegrationTestCooldownService} cooldown - The per-integration test cooldown.
   * @param {IntegrationsEncryptionService} encryption - Decrypts the stored secret.
   * @param {IntegrationTypeRegistry} registry - Resolves the row's type strategy.
   * @param {LoggerService} logger - Logs lazy re-encryptions (uuid and key ids only).
   */
  constructor(
    store: IntegrationStoreService,
    cooldown: IntegrationTestCooldownService,
    encryption: IntegrationsEncryptionService,
    registry: IntegrationTypeRegistry,
    logger: LoggerService,
  ) {
    this.store = store;
    this.cooldown = cooldown;
    this.encryption = encryption;
    this.registry = registry;
    this.logger = logger;
  }

  /**
   * Tests one of the caller's integrations.
   * @param {number} userId - The caller's id.
   * @param {string} uuid - The integration's uuid.
   * @returns {Promise<Integration>} The updated row.
   */
  async test(userId: number, uuid: string): Promise<Integration> {
    const row = await this.store.findOwned(userId, uuid);
    const now = new Date();
    const claim = await this.cooldown.claim(row.uuid, userId, now);

    if (!claim.claimed) {
      throw testCooldown(claim.retryAfterSeconds);
    }

    const strategy = this.registry.get(row.type);
    const secret = decryptRow(this.encryption, strategy, row);

    if (secret === null) {
      return this.store.updateOwned(row, {
        status: 'undecryptable',
        statusReason: null,
        lastTestedAt: now,
        lastTestResult: 'undecryptable',
      });
    }

    await this.reencryptIfPrevious(row);

    return this.record(row, await strategy.test(secret, toIntegrationView(row)), now);
  }

  /**
   * Re-encrypts a (successfully decrypted) row under the current key when it
   * is stored under a previous key. The write is conditioned on the old key
   * id, so it is a silent no-op when the secret changed meanwhile.
   * @param {Integration} row - The decrypted row.
   * @returns {Promise<void>} Resolves once rewritten (or skipped).
   */
  private async reencryptIfPrevious(row: Integration): Promise<void> {
    const fromKeyId = row.secretKeyId;

    if (!this.encryption.isPreviousKeyId(fromKeyId)) {
      return;
    }

    const encrypted = this.encryption.reencrypt(encryptedColumnsOf(row));

    if (encrypted !== null && await this.store.rewriteSecret(row, encrypted, fromKeyId)) {
      this.logger.info('integration secret re-encrypted', { uuid: row.uuid, fromKeyId, toKeyId: encrypted.keyId });
    }
  }

  /**
   * Records a test outcome on the row; a transient outcome is recorded and then thrown.
   * @param {Integration} row - The tested row.
   * @param {TestOutcome} outcome - The type's outcome.
   * @param {Date} now - The test time.
   * @returns {Promise<Integration>} The updated row.
   */
  private async record(row: Integration, outcome: TestOutcome, now: Date): Promise<Integration> {
    switch (outcome.kind) {
      case 'active':
        return this.store.updateOwned(row, {
          status: 'active',
          statusReason: null,
          githubLogin: outcome.githubLogin,
          expiresAt: outcome.expiresAt,
          metadata: this.registry.get(row.type).describeMetadata(outcome.metadata),
          lastTestedAt: now,
          lastTestResult: 'success',
        });
      case 'invalid':
        return this.rejected(row, { status: 'invalid', statusReason: outcome.reason }, now);
      case 'expired':
        return this.rejected(row, { status: 'expired', statusReason: null }, now);
      default:
        await this.store.updateOwned(row, { lastTestedAt: now, lastTestResult: 'transient_error' });
        throw outcome.error === 'rate_limited' ? githubRateLimited(outcome.retryAfterSeconds) : githubUnavailable();
    }
  }

  /**
   * Records a GitHub rejection.
   * @param {Integration} row - The tested row.
   * @param {Pick<Integration, 'status' | 'statusReason'>} status - The new status and reason.
   * @param {Date} now - The test time.
   * @returns {Promise<Integration>} The updated row.
   */
  private rejected(row: Integration, status: Pick<Integration, 'status' | 'statusReason'>, now: Date): Promise<Integration> {
    return this.store.updateOwned(row, { ...status, lastTestedAt: now, lastTestResult: 'rejected' });
  }
}

/**
 * Decrypts a row's secret and re-validates it against the type's payload shape.
 * @param {IntegrationsEncryptionService} encryption - The encryption service.
 * @param {IntegrationTypeStrategy} strategy - The row's type strategy.
 * @param {Integration} row - The stored row.
 * @returns {Secret | null} The payload, or `null` when undecryptable.
 */
export function decryptRow(
  encryption: IntegrationsEncryptionService,
  strategy: IntegrationTypeStrategy,
  row: Integration,
): Secret | null {
  const decrypted = encryption.decrypt(encryptedColumnsOf(row));

  return decrypted === null ? null : strategy.parseSecretPayload(decrypted);
}

/**
 * Reads a row's stored secret columns and binding, as the encryption service expects them.
 * @param {Pick<Integration, 'secretKeyId' | 'secretIv' | 'secretAuthTag' | 'secretCiphertext' | 'uuid' | 'type'>} row - The stored row.
 * @returns {EncryptedSecret & SecretBinding} The key id, IV, auth tag, ciphertext, uuid and type.
 */
export function encryptedColumnsOf(
  row: Pick<Integration, 'secretKeyId' | 'secretIv' | 'secretAuthTag' | 'secretCiphertext' | 'uuid' | 'type'>,
): EncryptedSecret & SecretBinding {
  return {
    keyId: row.secretKeyId,
    iv: row.secretIv,
    authTag: row.secretAuthTag,
    ciphertext: row.secretCiphertext,
    uuid: row.uuid,
    type: row.type,
  };
}
