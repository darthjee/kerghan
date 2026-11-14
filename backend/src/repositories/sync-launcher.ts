import { Injectable } from '@nestjs/common';
import { LoggerService } from '../core/logger.service.js';

/** A sync run, started detached. */
export type SyncTask = () => Promise<void>;

/**
 * The only way a sync is started (`docs/agents/modules/repositories/sync.md#execution`):
 * `launch(task)` detaches the run and catches its errors. Used as its own DI
 * token, so specs swap in a capturing launcher.
 */
export abstract class SyncLauncher {
  /**
   * Starts a sync run without waiting for it.
   * @param {SyncTask} task - The run.
   * @returns {void}
   */
  abstract launch(task: SyncTask): void;
}

/**
 * The production launcher: a detached, un-awaited promise. Anything the task
 * throws is caught and logged with safe fields (the error class only); the
 * run's own catch-all already released its lock.
 */
@Injectable()
export class DetachedSyncLauncher extends SyncLauncher {
  /**
   * @param {LoggerService} logger - The injected Core logger.
   */
  constructor(private readonly logger: LoggerService) {
    super();
  }

  /**
   * Starts the task detached.
   * @param {SyncTask} task - The run.
   * @returns {void}
   */
  launch(task: SyncTask): void {
    void Promise.resolve()
      .then(task)
      .catch((error: unknown) => {
        this.logger.error('repositories sync crashed', {
          context: 'DetachedSyncLauncher',
          errorClass: error instanceof Error ? error.constructor.name : typeof error,
        });
      });
  }
}
