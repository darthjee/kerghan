import { Injectable, type OnApplicationBootstrap, type OnModuleInit } from '@nestjs/common';
import { IssueMarkers } from './issue-markers.js';
import { IssueSyncQueue } from './issue-sync-queue.js';
import { IssuesConfig } from './issues-config.js';
import { IssuesSyncService } from './issues-sync.service.js';
import { ISSUES_RECONCILE_JOB, IssuesReconcileJob } from './jobs/issues-reconcile.job.js';
import { LoggerService } from '../core/logger.service.js';
import { WorkersService } from '../workers/workers.service.js';

/**
 * The sync's lifecycle hooks: it registers the `issues.reconcile` job on init (with the sync
 * service, the queue and the config as attributes, never a credential) and, at boot, enqueues one
 * reconcile per pending marker, oldest `marked_at` first, with no filtering (T5): the sync's
 * guards stop a marker that cannot run, and one attempt per boot is the accepted recovery path.
 */
@Injectable()
export class IssuesSyncBootstrap implements OnModuleInit, OnApplicationBootstrap {
  /**
   * @param {WorkersService} workers - Registers the job.
   * @param {IssuesSyncService} sync - Injected into every job.
   * @param {IssueSyncQueue} queue - Injected into every job; the boot sweep enqueues through it.
   * @param {IssuesConfig} config - Injected into every job (the retry values).
   * @param {IssueMarkers} markers - Lists the pending markers.
   * @param {LoggerService} logger - Safe-field logs only.
   */
  constructor(
    private readonly workers: WorkersService,
    private readonly sync: IssuesSyncService,
    private readonly queue: IssueSyncQueue,
    private readonly config: IssuesConfig,
    private readonly markers: IssueMarkers,
    private readonly logger: LoggerService,
  ) {}

  /**
   * Registers `issues.reconcile`.
   * @returns {void}
   */
  onModuleInit(): void {
    this.workers.register(ISSUES_RECONCILE_JOB, IssuesReconcileJob, { sync: this.sync, queue: this.queue, config: this.config });
  }

  /**
   * T5: enqueues every marker's link, oldest first. A failure is logged with the error class only
   * and never stops the boot.
   * @returns {Promise<void>} Resolves once the links are enqueued.
   */
  async onApplicationBootstrap(): Promise<void> {
    try {
      for (const linkId of await this.markers.listForBoot()) this.queue.enqueue(linkId);
    } catch (error) {
      this.logger.error('issues boot sweep failed', {
        context: 'IssuesSyncBootstrap',
        errorClass: error instanceof Error ? error.constructor.name : typeof error,
      });
    }
  }
}
