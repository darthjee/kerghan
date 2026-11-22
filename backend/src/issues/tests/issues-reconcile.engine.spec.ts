import type { LoggerService } from '../../core/logger.service.js';
import { done, resetDekuSwarm, type Deferred } from '../../workers/tests/support/reset-deku-swarm.js';
import type { WorkersConfig } from '../../workers/workers-config.js';
import { WorkersService } from '../../workers/workers.service.js';
import { IssueSyncQueue } from '../issue-sync-queue.js';
import { IssuesConfig } from '../issues-config.js';
import { IssuesSyncBootstrap } from '../issues-sync.bootstrap.js';
import type { ReconcileOutcome } from '../issues-sync.service.js';
import { ISSUES_RECONCILE_JOB } from '../jobs/issues-reconcile.job.js';

// `(engine)`: the real `WorkersService` and deku-swarm, with the issues retry config. The engine-wide
// values are deliberately different (2 retries) from the job's own (3), to show the job's getters win.
function logger() {
  return { debug: jest.fn(), info: jest.fn(), warn: jest.fn(), error: jest.fn() };
}

function buildWorld(issuesEnv: Record<string, string> = {}) {
  const log = logger();
  const workersConfig = { poolSize: 1, cooldownMs: 1_000, maxRetries: 2, sleepMs: 1, drainTimeoutMs: 50, drainPollMs: 5 } as WorkersConfig;
  const workers = new WorkersService(workersConfig, log as unknown as LoggerService);
  const queue = new IssueSyncQueue(workers, log as unknown as LoggerService);
  const config = new IssuesConfig({
    get: (key: string) => ({
      KERGHAN_ISSUES_SYNC_MAX_RETRIES: '3',
      KERGHAN_ISSUES_SYNC_COOLDOWN_MS: '1',
      ...issuesEnv,
    })[key],
  } as never);
  const calls: Array<{ linkId: number; lastAttempt: boolean }> = [];
  const sync = { reconcile: jest.fn() };
  const bootstrap = new IssuesSyncBootstrap(workers, sync as never, queue, config, { listForBoot: jest.fn(async () => []) } as never, log as never);

  workers.onModuleInit();
  bootstrap.onModuleInit();

  return { workers, queue, sync, calls, log, start: () => workers.onApplicationBootstrap() };
}

describe('issues.reconcile on the real engine (engine)', () => {
  let world: ReturnType<typeof buildWorld>;

  afterEach(async () => {
    await world.workers.onApplicationShutdown();
    resetDekuSwarm();
  });

  /** Scripts the service: answers the outcomes in order (the last one sticks), logging each call and resolving `finished` after `until` calls. */
  function script(outcomes: Array<ReconcileOutcome | ((lastAttempt: boolean) => ReconcileOutcome)>, until: number, finished: Deferred): void {
    world.sync.reconcile.mockImplementation(async (linkId: number, options: { lastAttempt: boolean }) => {
      world.calls.push({ linkId, lastAttempt: options.lastAttempt });

      const next = outcomes[Math.min(world.calls.length, outcomes.length) - 1];
      const outcome = typeof next === 'function' ? next(options.lastAttempt) : next;

      if (world.calls.length >= until) finished.resolve();

      return outcome;
    });
  }

  it('registers issues.reconcile by name: an enqueue runs the job with { linkId }', async () => {
    world = buildWorld();
    const finished = done();

    script([{ kind: 'done' }], 1, finished);
    world.start();
    world.queue.enqueue(7);
    await finished.promise;

    expect(world.calls).toEqual([{ linkId: 7, lastAttempt: false }]);
    expect(ISSUES_RECONCILE_JOB).toBe('issues.reconcile');
  });

  it('retries a transient failure after _fail, with the job\'s own cooldown rather than the engine-wide one', async () => {
    world = buildWorld();
    const finished = done();

    script([{ kind: 'transient' }, { kind: 'transient' }, { kind: 'done' }], 3, finished);
    world.start();
    world.queue.enqueue(7);
    await finished.promise;

    // Three attempts with the job's 1 ms cooldown (the engine-wide one is a second): the third succeeds, as the last allowed.
    expect(world.calls.map((call) => call.lastAttempt)).toEqual([false, false, true]);
  });

  it('E18: flags the last attempt from the job\'s own counter, and the service\'s retries_exhausted stop ends the retries', async () => {
    world = buildWorld();
    const finished = done();

    // A transient failure until the last attempt, where the real service sets sync_failed and stops.
    script([(lastAttempt) => (lastAttempt ? { kind: 'stopped', reason: 'retries_exhausted' } : { kind: 'transient' })], 3, finished);
    world.start();
    world.queue.enqueue(7);
    await finished.promise;
    // One more engine round shows that no further attempt follows the clean finish.
    await new Promise((resolve) => setTimeout(resolve, 20));

    expect(world.calls.map((call) => call.lastAttempt)).toEqual([false, false, true]);
  });

  it('honours the retry limit from the Issues config, not the engine-wide KERGHAN_WORKERS_* one', async () => {
    world = buildWorld({ KERGHAN_ISSUES_SYNC_MAX_RETRIES: '2' });
    const finished = done();

    script([(lastAttempt) => (lastAttempt ? { kind: 'stopped', reason: 'retries_exhausted' } : { kind: 'transient' })], 2, finished);
    world.start();
    world.queue.enqueue(7);
    await finished.promise;

    expect(world.calls.map((call) => call.lastAttempt)).toEqual([false, true]);
  });

  it('E17: a rate-limited job finishes without _fail, so it is never retried and consumes no attempt', async () => {
    world = buildWorld();
    const finished = done();

    script([{ kind: 'rate_limited', until: new Date('2026-06-01T12:00:00Z') }], 1, finished);
    world.start();
    world.queue.enqueue(7);
    await finished.promise;
    await new Promise((resolve) => setTimeout(resolve, 20));

    expect(world.calls).toEqual([{ linkId: 7, lastAttempt: false }]);
  });

  it('T6: a requeue enqueues a fresh job with fresh attempts', async () => {
    world = buildWorld();
    const finished = done();

    script([{ kind: 'transient' }, { kind: 'requeue' }, { kind: 'done' }], 3, finished);
    world.start();
    world.queue.enqueue(7);
    await finished.promise;

    // The third call is the fresh job: its own attempt counter starts over.
    expect(world.calls.map((call) => call.lastAttempt)).toEqual([false, false, false]);
  });

  it('logs the worker\'s error line without any detail of the failure', async () => {
    world = buildWorld();
    const finished = done();

    world.sync.reconcile.mockImplementation(async () => {
      finished.resolve();
      throw new TypeError('secret title of an issue');
    });
    world.start();
    world.queue.enqueue(7);
    await finished.promise;
    await new Promise((resolve) => setTimeout(resolve, 20));

    expect(JSON.stringify([...world.log.error.mock.calls, ...world.log.info.mock.calls])).not.toContain('secret title');
  });
});
