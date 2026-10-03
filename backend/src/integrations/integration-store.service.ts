import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { QueryFailedError, Repository } from 'typeorm';
import type { QueryDeepPartialEntity } from 'typeorm/query-builder/QueryPartialEntity.js';
import { Integration } from './entities/integration.entity.js';
import { ENSURE_LOCKOUT_ROW_SQL } from './integration-credential-abuse-guard.service.js';
import { integrationNotFound, labelTaken, limitReached } from './integration-http-errors.js';
import type { EncryptedSecret } from './integrations-encryption.service.js';

// Canonical UUID shape; anything else can't be an integration id and answers 404 without a query.
const UUID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

// Locks the owner's (just ensured) cool-off row until the transaction ends, so
// concurrent creates for one user serialize their cap check and insert.
export const LOCK_OWNER_ROW_SQL =
  'SELECT `id` FROM `integrations_credential_lockouts` WHERE `user_id` = ? FOR UPDATE';

// MySQL's driver error code for a unique-index violation.
const MYSQL_DUPLICATE_ENTRY_CODE = 'ER_DUP_ENTRY';

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

/**
 * Whether a write failed on a unique index.
 * @param {unknown} error - The caught value.
 * @returns {boolean} `true` for MySQL's `ER_DUP_ENTRY`.
 */
function isDuplicateEntry(error: unknown): boolean {
  if (!(error instanceof QueryFailedError)) {
    return false;
  }

  const driverError: unknown = error.driverError;

  return typeof driverError === 'object' && driverError !== null
    && (driverError as { code?: unknown }).code === MYSQL_DUPLICATE_ENTRY_CODE;
}
