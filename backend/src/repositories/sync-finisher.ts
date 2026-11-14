import { Injectable } from '@nestjs/common';
import { DataSource, type EntityManager } from 'typeorm';
import { LinkFiller } from './link-filler.js';
import { Pruner } from './pruner.js';
import { parseSourceKey } from './source-key.js';
import { SyncStateStore } from './sync-state.store.js';
import { IntegrationsGithubService } from '../integrations/integrations-github.public.js';

/**
 * The end of a sync (`docs/agents/specs/repos/sync.md#write-path`): one
 * `run_id`-guarded transaction running the safety net, the link fill, the
 * prune, then `finish` (`idle`, `last_synced_at = now`), even when every
 * source failed.
 */
@Injectable()
export class SyncFinisher {
  /**
   * @param {DataSource} dataSource - The connection (transactions).
   * @param {SyncStateStore} store - The run guard and `finish`.
   * @param {IntegrationsGithubService} github - Lists the user's integrations.
   * @param {LinkFiller} linkFiller - The link fill.
   * @param {Pruner} pruner - Source-row drops and pruning.
   */
  constructor(
    private readonly dataSource: DataSource,
    private readonly store: SyncStateStore,
    private readonly github: IntegrationsGithubService,
    private readonly linkFiller: LinkFiller,
    private readonly pruner: Pruner,
  ) {}

  /**
   * Ends the run.
   * @param {number} userId - The user.
   * @param {string} runId - The run.
   * @returns {Promise<boolean>} `false` when the run no longer owns the row (nothing written).
   */
  async finish(userId: number, runId: string): Promise<boolean> {
    const [all, usable] = await Promise.all([
      this.github.listIntegrations(userId),
      this.github.listUsableIntegrations(userId),
    ]);
    const allIds = all.map((ref) => ref.id);

    return this.dataSource.transaction(async (manager) => {
      if ((await this.store.guard(manager, userId, runId)) !== 'owned') return false;

      await this.#safetyNet(manager, userId, new Set(allIds));
      await this.linkFiller.fill(manager, userId, usable.map((ref) => ref.id), allIds);
      await this.pruner.prune(manager, userId);

      return this.store.finish(manager, userId, runId);
    });
  }

  /**
   * Drops the source, page and status rows of every `integration:<id>` key
   * whose integration is no longer among the user's (usable or not).
   * @param {EntityManager} manager - The transaction.
   * @param {number} userId - The user.
   * @param {Set<number>} allIds - Every integration id of the user.
   * @returns {Promise<void>} Resolves once dropped.
   */
  async #safetyNet(manager: EntityManager, userId: number, allIds: Set<number>): Promise<void> {
    const rows: Array<{ source_key: string }> = await manager.query(
      'SELECT source_key FROM repositories_sources WHERE user_id = ? '
      + 'UNION SELECT source_key FROM repositories_source_pages WHERE user_id = ? '
      + 'UNION SELECT source_key FROM repositories_source_statuses WHERE user_id = ?',
      [userId, userId, userId],
    );
    const gone = rows.map((row) => row.source_key).filter((key) => {
      const parsed = parseSourceKey(key);

      return parsed?.kind === 'integration' && !allIds.has(parsed.integrationId);
    });

    await this.pruner.dropSources(manager, userId, gone);
  }
}
