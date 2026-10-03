import { Injectable } from '@nestjs/common';
import { LoggerService } from '../core/logger.service.js';
import type { Integration } from './entities/integration.entity.js';
import { encryptedColumnsOf } from './integration-connection-test.service.js';
import { IntegrationStoreService } from './integration-store.service.js';
import { IntegrationsEncryptionService } from './integrations-encryption.service.js';

// Rows read (and re-encrypted) per batch.
export const REENCRYPT_BATCH_SIZE = 100;

/**
 * How a stored key id relates to the configured key set.
 */
export type KeyIdRole = 'current' | 'previous' | 'unknown';

/**
 * One line of the key status report.
 * @property {string} keyId - The 8-character key id.
 * @property {KeyIdRole} role - Whether it is the current, a previous or an unknown key.
 * @property {number} count - How many integrations are stored under it.
 */
export interface KeyStatusLine {
  keyId: string;
  role: KeyIdRole;
  count: number;
}

/**
 * The outcome of a re-encryption run.
 * @property {number} reencrypted - Rows moved to the current key.
 * @property {number} skippedUndecryptable - Rows under a previous key that failed to decrypt (left untouched).
 * @property {number} skippedChanged - Rows whose secret changed concurrently (left to the concurrent write).
 */
export interface ReencryptResult {
  reencrypted: number;
  skippedUndecryptable: number;
  skippedChanged: number;
}

// Order in which roles are reported.
const ROLE_ORDER: KeyIdRole[] = ['current', 'previous', 'unknown'];

/**
 * Operator-only `KERGHAN_INTEGRATIONS_KEY` rotation support, driven by the
 * `integrations-keys` CLI (never by a request): reports how many rows each
 * key id holds, and re-encrypts every row still under a previous key with
 * the current key. Logs only uuids and key ids, never a key, ciphertext or
 * secret.
 */
@Injectable()
export class IntegrationsKeyRotationService {
  private readonly store: IntegrationStoreService;
  private readonly encryption: IntegrationsEncryptionService;
  private readonly logger: LoggerService;

  /**
   * @param {IntegrationStoreService} store - Supplies the operator-only reads and the conditional rewrite.
   * @param {IntegrationsEncryptionService} encryption - Knows the key set and re-encrypts.
   * @param {LoggerService} logger - Logs skipped rows (uuid and key id only).
   */
  constructor(store: IntegrationStoreService, encryption: IntegrationsEncryptionService, logger: LoggerService) {
    this.store = store;
    this.encryption = encryption;
    this.logger = logger;
  }

  /**
   * Counts the integrations under each key id: the current key first, then
   * the previous keys in configured order (both listed even with 0 rows),
   * then unknown key ids in id order. Read-only.
   * @returns {Promise<KeyStatusLine[]>} One line per key id.
   */
  async status(): Promise<KeyStatusLine[]> {
    const counts = new Map((await this.store.countBySecretKeyIdForOperator()).map(({ keyId, count }) => [keyId, count]));
    const configured = [this.encryption.currentKeyId, ...this.encryption.previousKeyIds];
    const unknown = [...counts.keys()].filter((keyId) => !configured.includes(keyId)).sort();

    return [...configured, ...unknown]
      .map((keyId) => ({ keyId, role: this.roleOf(keyId), count: counts.get(keyId) ?? 0 }))
      .sort((a, b) => ROLE_ORDER.indexOf(a.role) - ROLE_ORDER.indexOf(b.role));
  }

  /**
   * Re-encrypts, in id-ordered batches, every row stored under a previous
   * key with the current key. Each rewrite is conditioned on the row's old
   * key id, so a concurrent credential replacement wins (counted as
   * `skippedChanged`); a row that fails to decrypt is logged by uuid, left
   * untouched and counted as `skippedUndecryptable`. Idempotent.
   * @returns {Promise<ReencryptResult>} The counts.
   */
  async reencrypt(): Promise<ReencryptResult> {
    const result: ReencryptResult = { reencrypted: 0, skippedUndecryptable: 0, skippedChanged: 0 };
    const previousKeyIds = this.encryption.previousKeyIds;
    let afterId = 0;
    let batch: Integration[];

    do {
      batch = await this.store.findBySecretKeyIdsForOperator(previousKeyIds, afterId, REENCRYPT_BATCH_SIZE);

      for (const row of batch) {
        result[await this.reencryptRow(row)] += 1;
        afterId = row.id;
      }
    } while (batch.length === REENCRYPT_BATCH_SIZE);

    return result;
  }

  /**
   * Classifies a key id against the configured key set.
   * @param {string} keyId - The stored key id.
   * @returns {KeyIdRole} Its role.
   */
  private roleOf(keyId: string): KeyIdRole {
    if (this.encryption.isCurrentKeyId(keyId)) {
      return 'current';
    }

    return this.encryption.isPreviousKeyId(keyId) ? 'previous' : 'unknown';
  }

  /**
   * Re-encrypts one row under the current key.
   * @param {Integration} row - The row (partial: id, owner, uuid, type and secret columns).
   * @returns {Promise<keyof ReencryptResult>} Which counter the row adds to.
   */
  private async reencryptRow(row: Integration): Promise<keyof ReencryptResult> {
    const fromKeyId = row.secretKeyId;
    const encrypted = this.encryption.reencrypt(encryptedColumnsOf(row));

    if (encrypted === null) {
      this.logger.warn('integration secret undecryptable, not re-encrypted', { uuid: row.uuid, keyId: fromKeyId });
      return 'skippedUndecryptable';
    }

    if (!await this.store.rewriteSecret(row, encrypted, fromKeyId)) {
      this.logger.warn('integration secret changed concurrently, not re-encrypted', { uuid: row.uuid, keyId: fromKeyId });
      return 'skippedChanged';
    }

    this.logger.debug('integration secret re-encrypted', { uuid: row.uuid, fromKeyId, toKeyId: encrypted.keyId });
    return 'reencrypted';
  }
}

/**
 * Formats the status report as the CLI prints it: one
 * `<keyId> <current|previous|unknown> <count>` line per key id.
 * @param {KeyStatusLine[]} lines - The status lines.
 * @returns {string} The text, newline-terminated (empty when there are no lines).
 */
export function formatKeyStatus(lines: KeyStatusLine[]): string {
  return lines.map(({ keyId, role, count }) => `${keyId} ${role} ${count}\n`).join('');
}

/**
 * Formats a re-encryption summary as the CLI prints it.
 * @param {ReencryptResult} result - The counts.
 * @returns {string} `reencrypted=<n> skipped_undecryptable=<n> skipped_changed=<n>`, newline-terminated.
 */
export function formatReencryptSummary(result: ReencryptResult): string {
  return `reencrypted=${result.reencrypted} skipped_undecryptable=${result.skippedUndecryptable} `
    + `skipped_changed=${result.skippedChanged}\n`;
}

/**
 * The CLI exit code of a re-encryption run.
 * @param {ReencryptResult} result - The counts.
 * @returns {number} `1` when any row was undecryptable, `0` otherwise.
 */
export function reencryptExitCode(result: ReencryptResult): number {
  return result.skippedUndecryptable > 0 ? 1 : 0;
}
