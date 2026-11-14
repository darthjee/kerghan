import { Injectable } from '@nestjs/common';
import { DataSource } from 'typeorm';
import { Clock } from '../core/clock.js';
import type { IntegrationRef } from '../integrations/integrations-github.public.js';
import type { SourceStatus } from './entities/repository-source-status.entity.js';
import { RepositoriesConfig } from './repositories-config.js';
import { currentKeys, type ListingScope, sourceRef } from './repositories-listing.query.js';
import { integrationSourceKey } from './source-key.js';
import type { SyncStateView } from './sync-state.store.js';
import type { SourceState, SyncStateResult } from './types/repositories-api.types.js';

interface StoredStatus {
  status: SourceStatus;
  syncedAt: Date;
  resetAt: Date | null;
}

/**
 * Derives the sync-state object (`docs/agents/backend/routes/repositories.md#sync-state`)
 * from the lease-aware row read and the stored source statuses: one entry per
 * current source, `pending` with no status row, and `pending` for a stored
 * `invalid_credentials` of an integration usable again. Reads only; never
 * starts a sync.
 */
@Injectable()
export class SyncStateReader {
  /**
   * @param {DataSource} dataSource - The connection.
   * @param {RepositoriesConfig} config - The Refresh cooldown.
   * @param {Clock} clock - The time source.
   */
  constructor(
    private readonly dataSource: DataSource,
    private readonly config: RepositoriesConfig,
    private readonly clock: Clock,
  ) {}

  /**
   * Builds the sync-state object.
   * @param {number} userId - The user.
   * @param {SyncStateView} view - The lease-aware row read (a dead lease reads `idle`).
   * @param {ListingScope} scope - The current sources.
   * @param {IntegrationRef[]} usable - The usable integrations.
   * @returns {Promise<SyncStateResult>} The object.
   */
  async read(userId: number, view: SyncStateView, scope: ListingScope, usable: IntegrationRef[]): Promise<SyncStateResult> {
    const stored = await this.#statuses(userId);
    const usableKeys = new Set(usable.map((ref) => integrationSourceKey(ref.id)));

    return {
      state: view.state,
      startedAt: view.state === 'syncing' ? view.lastStartedAt : null,
      lastSyncedAt: view.lastSyncedAt,
      refreshAvailableAt: this.refreshAvailableAt(view.lastStartedAt),
      sources: currentKeys(scope).map((key) => ({ ...sourceRef(scope, key), ...reported(stored.get(key), usableKeys.has(key)) }) as SourceState),
    };
  }

  /**
   * The end of the Refresh cooldown, or `null` once it passed.
   * @param {Date | null} lastStartedAt - The last sync's start.
   * @returns {Date | null} `last_started_at` + cooldown while still ahead.
   */
  refreshAvailableAt(lastStartedAt: Date | null): Date | null {
    if (lastStartedAt === null) return null;

    const end = this.cooldownEnd(lastStartedAt);

    return end > this.clock.now() ? end : null;
  }

  /**
   * @param {Date} lastStartedAt - The last sync's start.
   * @returns {Date} The end of its Refresh cooldown.
   */
  cooldownEnd(lastStartedAt: Date): Date {
    return new Date(lastStartedAt.getTime() + this.config.cooldownMs);
  }

  /**
   * @param {number} userId - The user.
   * @returns {Promise<Map<string, StoredStatus>>} The stored statuses, by source key.
   */
  async #statuses(userId: number): Promise<Map<string, StoredStatus>> {
    const rows: Array<{ source_key: string; status: SourceStatus; synced_at: Date; reset_at: Date | null }> = await this.dataSource.query(
      'SELECT source_key, status, synced_at, reset_at FROM repositories_source_statuses WHERE user_id = ?',
      [userId],
    );

    return new Map(rows.map((row) => [row.source_key, { status: row.status, syncedAt: row.synced_at, resetAt: row.reset_at }]));
  }
}

/**
 * @param {StoredStatus | undefined} stored - The stored status, if any.
 * @param {boolean} usable - Whether the source is a usable integration.
 * @returns {Pick<SourceState, 'status' | 'syncedAt' | 'resetAt'>} The reported status.
 */
function reported(stored: StoredStatus | undefined, usable: boolean): Pick<SourceState, 'status' | 'syncedAt' | 'resetAt'> {
  if (stored === undefined || (stored.status === 'invalid_credentials' && usable)) {
    return { status: 'pending', syncedAt: null, resetAt: null };
  }

  return { status: stored.status, syncedAt: stored.syncedAt, resetAt: stored.status === 'rate_limited' ? stored.resetAt : null };
}
