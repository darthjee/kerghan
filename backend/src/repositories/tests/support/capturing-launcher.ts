import { SyncLauncher, type SyncTask } from '../../sync-launcher.js';

/**
 * A `SyncLauncher` that records tasks without running them
 * (`docs/agents/modules/repositories.md#detached-sync-and-time`). A spec
 * asserts the triggering call's answer first, then runs the captured runs.
 */
export class CapturingLauncher extends SyncLauncher {
  readonly tasks: SyncTask[] = [];
  readonly errors: unknown[] = [];
  launched = 0;

  launch(task: SyncTask): void {
    this.launched += 1;
    this.tasks.push(task);
  }

  /** Runs the oldest captured task and resolves once it settles. */
  async runNext(): Promise<void> {
    const task = this.tasks.shift();

    if (task === undefined) throw new Error('CapturingLauncher: no captured task');
    await this.#settle(task);
  }

  /** Starts the oldest captured task without awaiting it (race specs), and returns its settle promise. */
  startNext(): Promise<void> {
    const task = this.tasks.shift();

    if (task === undefined) throw new Error('CapturingLauncher: no captured task');
    return this.#settle(task);
  }

  /** Runs every captured task (including ones queued while running) and resolves once they settle. */
  async runAll(): Promise<void> {
    while (this.tasks.length > 0) {
      const batch = this.tasks.splice(0);

      await Promise.all(batch.map((task) => this.#settle(task)));
    }
  }

  async #settle(task: SyncTask): Promise<void> {
    try {
      await task();
    } catch (error) {
      this.errors.push(error);
    }
  }
}
