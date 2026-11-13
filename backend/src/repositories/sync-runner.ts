import { Injectable } from '@nestjs/common';
import { HandleReconciler } from './handle-reconciler.js';
import { PageWriter } from './page-writer.js';
import { RepositoriesConfig, SYNC_HARD_DEADLINE_MS, SYNC_PARALLELISM } from './repositories-config.js';
import { HANDLE_SOURCE_KEY, integrationSourceKey } from './source-key.js';
import { type RunContext, type SourceEnd, type SourcePlan, SourceRunner } from './source-runner.js';
import { SyncFinisher } from './sync-finisher.js';
import type { SyncTask } from './sync-launcher.js';
import { SyncStateStore } from './sync-state.store.js';
import { Clock } from '../core/clock.js';
import { LoggerService } from '../core/logger.service.js';
import { IntegrationsGithubService, type IntegrationRef } from '../integrations/integrations-github.public.js';

/**
 * One sync run of one user (`docs/agents/specs/repos/sync.md`): the
 * start-of-run handle reconciliation (with no sync-state row the run
 * stops), the sources (each integration, usable or not, and the handle),
 * up to `SYNC_PARALLELISM` at once, then the end of sync. A source whose
 * stored `rate_limited` reset is still ahead is skipped with no call.
 */
@Injectable()
export class SyncRunner {
  /**
   * @param {HandleReconciler} reconciler - The start-of-run reconciliation.
   * @param {SyncStateStore} store - The lock (lease read, release).
   * @param {IntegrationsGithubService} github - Lists the user's integrations.
   * @param {SourceRunner} sources - Runs one source.
   * @param {PageWriter} writer - Reads the stored source statuses.
   * @param {SyncFinisher} finisher - The end of sync.
   * @param {RepositoriesConfig} config - The page cap.
   * @param {Clock} clock - The time source.
   * @param {LoggerService} logger - Safe-field logs only.
   */
  constructor(
    private readonly reconciler: HandleReconciler,
    private readonly store: SyncStateStore,
    private readonly github: IntegrationsGithubService,
    private readonly sources: SourceRunner,
    private readonly writer: PageWriter,
    private readonly finisher: SyncFinisher,
    private readonly config: RepositoriesConfig,
    private readonly clock: Clock,
    private readonly logger: LoggerService,
  ) {}

  /**
   * The detached task for a claimed run, with its catch-all: an unexpected
   * exception releases the lock (`run_id`-guarded, never `last_synced_at`)
   * and is logged with safe fields only.
   * @param {number} userId - The user.
   * @param {string} runId - The claimed run.
   * @returns {SyncTask} The task to launch.
   */
  task(userId: number, runId: string): SyncTask {
    return async () => {
      try {
        await this.run(userId, runId);
      } catch (error) {
        this.logger.error('repositories sync failed', {
          context: 'SyncRunner',
          userId,
          errorClass: error instanceof Error ? error.constructor.name : typeof error,
        });
        await this.store.release(userId, runId);
      }
    };
  }

  /**
   * Runs a claimed sync to its end.
   * @param {number} userId - The user.
   * @param {string} runId - The claimed run.
   * @returns {Promise<void>} Resolves once the run ended or stopped.
   */
  async run(userId: number, runId: string): Promise<void> {
    const start = await this.reconciler.forRun(userId);

    if (start.kind === 'no_row') return;

    const state = await this.store.readState(userId);
    const startedAt = state.lastStartedAt ?? this.clock.now();
    const ctx: RunContext = {
      userId,
      runId,
      handle: start.handle,
      deadline: new Date(startedAt.getTime() + SYNC_HARD_DEADLINE_MS),
      pageCap: this.config.pageCap,
    };
    const plans = await this.#plans(ctx);
    const ends = await runPool(plans, SYNC_PARALLELISM, (plan) => this.sources.run(ctx, plan));

    if (ends.includes('lost')) return;

    await this.finisher.finish(userId, runId);
  }

  /**
   * The run's sources, without the `rate_limited` ones still before their reset.
   * @param {RunContext} ctx - The run.
   * @returns {Promise<SourcePlan[]>} The sources to run.
   */
  async #plans(ctx: RunContext): Promise<SourcePlan[]> {
    const [all, usable, skipped] = await Promise.all([
      this.github.listIntegrations(ctx.userId),
      this.github.listUsableIntegrations(ctx.userId),
      this.#rateLimitedKeys(ctx.userId),
    ]);
    const plans: SourcePlan[] = all.map((ref: IntegrationRef) => ({
      kind: 'integration', key: integrationSourceKey(ref.id), integrationId: ref.id,
    }));

    if (ctx.handle !== null) {
      plans.push({ kind: 'handle', handle: ctx.handle, credentials: [...usable.map((ref) => ref.id), null] });
    }

    return plans.filter((plan) => !skipped.has(plan.kind === 'handle' ? HANDLE_SOURCE_KEY : plan.key));
  }

  /**
   * @param {number} userId - The user.
   * @returns {Promise<Set<string>>} The keys of `rate_limited` sources whose reset is still ahead.
   */
  async #rateLimitedKeys(userId: number): Promise<Set<string>> {
    const rows = await this.writer.rateLimitedSources(userId, this.clock.now());

    return new Set(rows);
  }
}

/**
 * Runs `work` over `items`, at most `limit` at once, in order.
 * @param {T[]} items - The items.
 * @param {number} limit - The parallelism bound.
 * @param {Function} work - The work per item.
 * @returns {Promise<SourceEnd[]>} The results, in item order.
 */
async function runPool<T>(items: T[], limit: number, work: (item: T) => Promise<SourceEnd>): Promise<SourceEnd[]> {
  const results: SourceEnd[] = new Array(items.length);
  let next = 0;
  const worker = async (): Promise<void> => {
    while (next < items.length) {
      const index = next;

      next += 1;
      results[index] = await work(items[index]);
    }
  };

  await Promise.all(Array.from({ length: Math.min(limit, items.length) }, worker));

  return results;
}
