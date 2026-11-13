import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { In, MoreThan, Repository } from 'typeorm';
import type { QueryDeepPartialEntity } from 'typeorm/query-builder/QueryPartialEntity.js';
import { isDuplicateEntry } from './duplicate-entry.js';
import { Integration } from './entities/integration.entity.js';
import { ENSURE_LOCKOUT_ROW_SQL } from './integration-credential-abuse-guard.service.js';
import type { IntegrationStatus } from './integration-enums.js';
import { integrationNotFound, labelTaken, limitReached } from './integration-http-errors.js';
import type { EncryptedSecret } from './integrations-encryption.service.js';

// Canonical UUID shape; anything else can't be an integration id and answers 404 without a query.
const UUID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

// Locks the owner's (just ensured) cool-off row until the transaction ends, so
// concurrent creates for one user serialize their cap check and insert.
export const LOCK_OWNER_ROW_SQL =
  'SELECT `id` FROM `integrations_credential_lockouts` WHERE `user_id` = ? FOR UPDATE';

// Columns the operator-only key-rotation batch read selects (no label, metadata, etc.).
const ROTATION_COLUMNS = {
  id: true,
  userId: true,
  uuid: true,
  type: true,
  secretKeyId: true,
  secretIv: true,
  secretAuthTag: true,
  secretCiphertext: true,
} as const;

/**
 * How many integrations are stored under one `secret_key_id`.
 */
export interface SecretKeyIdCount {
  keyId: string;
  count: number;
}

/**
 * Owner-scoped persistence for the `integrations` table. Every query
 * carries the owner (`user_id`) in the query itself, never by loading a
 * row and comparing afterwards (see
 * `docs/agents/modules/integrations.md#access-rules`).
 */
@Injectable()
export class IntegrationStoreService {
  private readonly repository: Repository<Integration>;

  /**
   * @param {Repository<Integration>} repository - The integration repository.
   */
  constructor(@InjectRepository(Integration) repository: Repository<Integration>) {
    this.repository = repository;
  }

  /**
   * Lists the owner's integrations, newest first.
   * @param {number} userId - The owner's id.
   * @returns {Promise<Integration[]>} The rows.
   */
  listOwned(userId: number): Promise<Integration[]> {
    return this.repository.find({ where: { userId }, order: { createdAt: 'DESC', id: 'DESC' } });
  }

  /**
   * Finds one of the owner's integrations; a missing, foreign or malformed uuid answers 404.
   * @param {number} userId - The owner's id.
   * @param {string} uuid - The integration's uuid.
   * @returns {Promise<Integration>} The row.
   */
  async findOwned(userId: number, uuid: string): Promise<Integration> {
    const row = UUID_PATTERN.test(uuid) ? await this.repository.findOne({ where: { uuid, userId } }) : null;

    if (row === null) {
      throw integrationNotFound();
    }

    return row;
  }

  /**
   * Finds one of the owner's integrations by internal id.
   * @param {number} userId - The owner's id.
   * @param {number} id - The internal `integrations.id`.
   * @returns {Promise<Integration | null>} The row, or `null` when missing or foreign.
   */
  findOwnedById(userId: number, id: number): Promise<Integration | null> {
    return this.repository.findOne({ where: { id, userId } });
  }

  /**
   * Lists the owner's integrations, oldest first (`created_at`, then `id`).
   * @param {number} userId - The owner's id.
   * @returns {Promise<Integration[]>} The rows.
   */
  listOwnedOldestFirst(userId: number): Promise<Integration[]> {
    return this.repository.find({ where: { userId }, order: { createdAt: 'ASC', id: 'ASC' } });
  }

  /**
   * Reads the `secret_iv` an integration holds (owner-scoped; never leaves the module).
   * @param {number} userId - The owner's id.
   * @param {number} id - The internal `integrations.id`.
   * @returns {Promise<Buffer | null>} The IV, or `null` when the row is gone.
   */
  async readSecretIv(userId: number, id: number): Promise<Buffer | null> {
    const row = await this.repository.findOne({ select: { id: true, secretIv: true }, where: { id, userId } });

    return row?.secretIv ?? null;
  }

  /**
   * Sets the status only while the row holds the credential a call used
   * (`… AND secret_iv = ?`), so a Replace or key rotation in between makes it a no-op.
   * @param {Pick<Integration, 'id' | 'userId'>} row - The row the call loaded.
   * @param {Buffer} ivUsed - The `secret_iv` read with the decrypted row.
   * @param {IntegrationStatus} status - The new status.
   * @param {string | null} statusReason - The new reason.
   * @returns {Promise<boolean>} `true` when the row changed.
   */
  async setStatusIfCredential(row: Pick<Integration, 'id' | 'userId'>, ivUsed: Buffer, status: IntegrationStatus,
    statusReason: string | null): Promise<boolean> {
    const result = await this.repository.update({ id: row.id, userId: row.userId, secretIv: ivUsed }, { status, statusReason });

    return (result.affected ?? 0) > 0;
  }

  /**
   * Counts the owner's integrations, whatever their status.
   * @param {number} userId - The owner's id.
   * @returns {Promise<number>} The count.
   */
  countOwned(userId: number): Promise<number> {
    return this.repository.count({ where: { userId } });
  }

  /**
   * Fails with 409 `INTEGRATION_LABEL_TAKEN` when another of the owner's rows uses the label.
   * @param {number} userId - The owner's id.
   * @param {string} labelNormalized - The trimmed, lower-cased label.
   * @param {number} [exceptId] - A row allowed to hold the label (the one being renamed).
   * @returns {Promise<void>} Resolves when the label is free.
   */
  async assertLabelFree(userId: number, labelNormalized: string, exceptId?: number): Promise<void> {
    const holder = await this.repository.findOne({ where: { userId, labelNormalized } });

    if (holder !== null && holder.id !== exceptId) {
      throw labelTaken();
    }
  }

  /**
   * Inserts a new row unless the owner already holds `maxPerUser` rows
   * (409 `INTEGRATIONS_LIMIT_REACHED`). The cap check and the insert run in
   * one transaction holding a lock on the owner's row in
   * `integrations_credential_lockouts` (one per user, created on demand), so
   * concurrent creates can't exceed the cap. The count is a plain read taken
   * after the lock, so it sees every insert committed before it. A
   * `(user_id, label_normalized)` race answers 409 `INTEGRATION_LABEL_TAKEN`.
   * @param {Partial<Integration> & { userId: number }} attributes - The row's columns.
   * @param {number} maxPerUser - The per-user cap.
   * @returns {Promise<Integration>} The inserted row.
   */
  async insertWithinCap(attributes: Partial<Integration> & { userId: number }, maxPerUser: number): Promise<Integration> {
    const { userId } = attributes;

    return this.guardLabelRace(() => this.repository.manager.transaction(async (manager) => {
      await manager.query(ENSURE_LOCKOUT_ROW_SQL, [userId]);
      await manager.query(LOCK_OWNER_ROW_SQL, [userId]);

      if (await manager.count(Integration, { where: { userId } }) >= maxPerUser) {
        throw limitReached();
      }

      return manager.save(manager.create(Integration, attributes));
    }));
  }

  /**
   * Updates one of the owner's rows and returns it merged with the changes.
   * @param {Integration} row - The row, already loaded through `findOwned`.
   * @param {Partial<Integration>} changes - The columns to change.
   * @returns {Promise<Integration>} The updated row.
   */
  async updateOwned(row: Integration, changes: Partial<Integration>): Promise<Integration> {
    await this.guardLabelRace(() => this.repository.update(
      { id: row.id, userId: row.userId },
      changes as QueryDeepPartialEntity<Integration>,
    ));

    return Object.assign(row, changes, { updatedAt: new Date() });
  }

  /**
   * Rewrites a row's four secret columns, but only while its stored key id
   * is still `expectedKeyId`: the `UPDATE` is scoped by `id`, `user_id` and
   * `secret_key_id`, so a concurrent credential replacement is never
   * clobbered (0 affected rows is a silent no-op). On success the loaded row
   * is updated in place.
   * @param {Pick<Integration, 'id' | 'userId'> & Partial<Integration>} row - The row to rewrite.
   * @param {EncryptedSecret} encrypted - The new key id, IV, auth tag and ciphertext.
   * @param {string} expectedKeyId - The key id the row must still hold.
   * @returns {Promise<boolean>} `true` when the row was rewritten.
   */
  async rewriteSecret(
    row: Pick<Integration, 'id' | 'userId'> & Partial<Integration>,
    encrypted: EncryptedSecret,
    expectedKeyId: string,
  ): Promise<boolean> {
    const changes = {
      secretKeyId: encrypted.keyId,
      secretIv: encrypted.iv,
      secretAuthTag: encrypted.authTag,
      secretCiphertext: encrypted.ciphertext,
    };
    const result = await this.repository.update({ id: row.id, userId: row.userId, secretKeyId: expectedKeyId }, changes);

    if ((result.affected ?? 0) === 0) {
      return false;
    }

    Object.assign(row, changes);

    return true;
  }

  /**
   * OPERATOR-ONLY (key-rotation CLI; never call from a request path): counts
   * every user's integrations grouped by `secret_key_id`. Not owner-scoped.
   * @returns {Promise<SecretKeyIdCount[]>} One entry per stored key id.
   */
  async countBySecretKeyIdForOperator(): Promise<SecretKeyIdCount[]> {
    const raw = await this.repository
      .createQueryBuilder('integration')
      .select('integration.secret_key_id', 'keyId')
      .addSelect('COUNT(*)', 'count')
      .groupBy('integration.secret_key_id')
      .getRawMany<{ keyId: string; count: string | number }>();

    return raw.map(({ keyId, count }) => ({ keyId, count: Number(count) }));
  }

  /**
   * OPERATOR-ONLY (key-rotation CLI; never call from a request path): reads
   * one batch of any user's rows stored under one of `keyIds`, with an id
   * above `afterId`, in id order, selecting only the columns re-encryption
   * needs. Not owner-scoped.
   * @param {string[]} keyIds - The `secret_key_id`s to match.
   * @param {number} afterId - The cursor: only rows with a greater id.
   * @param {number} limit - The batch size.
   * @returns {Promise<Integration[]>} The batch (partial rows).
   */
  findBySecretKeyIdsForOperator(keyIds: string[], afterId: number, limit: number): Promise<Integration[]> {
    if (keyIds.length === 0) {
      return Promise.resolve([]);
    }

    return this.repository.find({
      select: ROTATION_COLUMNS,
      where: { secretKeyId: In(keyIds), id: MoreThan(afterId) },
      order: { id: 'ASC' },
      take: limit,
    });
  }

  /**
   * Deletes one of the owner's rows.
   * @param {Integration} row - The row, already loaded through `findOwned`.
   * @returns {Promise<void>} Resolves once deleted.
   */
  async deleteOwned(row: Integration): Promise<void> {
    await this.repository.delete({ id: row.id, userId: row.userId });
  }

  /**
   * Runs a write, turning a unique-index violation into 409 `INTEGRATION_LABEL_TAKEN`.
   * @param {() => Promise<T>} write - The write.
   * @returns {Promise<T>} The write's result.
   */
  private async guardLabelRace<T>(write: () => Promise<T>): Promise<T> {
    try {
      return await write();
    } catch (error) {
      throw isDuplicateEntry(error) ? labelTaken() : error;
    }
  }
}
