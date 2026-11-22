import { FakeWorkersService } from '../../workers/tests/support/fake-workers.service.js';
import { IssueSyncQueue } from '../issue-sync-queue.js';
import { IssuesConfig } from '../issues-config.js';
import type { ReconcileOutcome } from '../issues-sync.service.js';
import { ISSUES_RECONCILE_JOB, IssuesReconcileJob } from '../jobs/issues-reconcile.job.js';

function config(values: Record<string, string> = {}): IssuesConfig {
  return new IssuesConfig({ get: (key: string) => values[key] } as never);
}

describe('IssuesReconcileJob', () => {
  let workers: FakeWorkersService;
  let queue: IssueSyncQueue;
  let sync: { reconcile: jest.Mock };

  beforeEach(() => {
    workers = new FakeWorkersService();
    queue = new IssueSyncQueue(workers as never, { error: jest.fn() } as never);
    sync = { reconcile: jest.fn() };
  });

  function build(linkId: unknown = 5, values: Record<string, string> = {}): IssuesReconcileJob {
    return new IssuesReconcileJob({ id: 'job-1', linkId, sync, queue, config: config(values) } as never);
  }

  function respond(...outcomes: ReconcileOutcome[]): void {
    for (const outcome of outcomes) sync.reconcile.mockResolvedValueOnce(outcome);
  }

  function logger() {
    return { debug: jest.fn(), info: jest.fn(), warn: jest.fn(), error: jest.fn() };
  }

  it('is registered under issues.reconcile', () => {
    expect(ISSUES_RECONCILE_JOB).toBe('issues.reconcile');
  });

  describe('retry values', () => {
    it('reads maxRetries 5 and a 30 second cooldown by default', () => {
      const job = build();

      expect(job.maxRetries).toBe(5);
      expect(job.cooldown).toBe(30_000);
    });

    it('reads them from the Issues config, not the engine-wide ones', () => {
      const job = build(5, { KERGHAN_ISSUES_SYNC_MAX_RETRIES: '2', KERGHAN_ISSUES_SYNC_COOLDOWN_MS: '1500' });

      expect(job.maxRetries).toBe(2);
      expect(job.cooldown).toBe(1_500);
    });
  });

  describe('outcome mapping', () => {
    it.each([
      ['done', { kind: 'done' }],
      ['stopped', { kind: 'stopped', reason: 'credential' }],
      ['rate_limited', { kind: 'rate_limited', until: new Date('2026-06-01T12:00:00Z') }],
    ] as Array<[string, ReconcileOutcome]>)('finishes cleanly on %s, enqueuing nothing', async (_kind, outcome) => {
      respond(outcome);

      await expect(build().perform(logger())).resolves.toBeUndefined();
      expect(workers.enqueued).toEqual([]);
    });

    it('enqueues a fresh job through the dedupe on requeue (T6), then finishes cleanly', async () => {
      respond({ kind: 'requeue' });

      await expect(build().perform(logger())).resolves.toBeUndefined();

      expect(workers.paramsOf(ISSUES_RECONCILE_JOB)).toEqual([{ linkId: 5 }]);
    });

    it('a requeue enqueues even though the link was queued before: it left the set when the job started', async () => {
      queue.enqueue(5);
      respond({ kind: 'requeue' });
      await build().perform(logger());

      expect(workers.enqueued).toHaveLength(2);
    });

    it('fails on transient, with a fixed message', async () => {
      respond({ kind: 'transient' });

      await expect(build().perform(logger())).rejects.toThrow(new Error('issues reconcile transient failure'));
    });

    it('fails on an unexpected error with a fixed message that carries none of its own', async () => {
      sync.reconcile.mockRejectedValueOnce(new TypeError('SELECT secret FROM table'));
      const log = logger();

      const failure = await build().perform(log).catch((error: Error) => error);

      expect(failure).toEqual(new Error('issues reconcile failed'));
      expect(log.error).toHaveBeenCalledWith('issues reconcile link=5 failed: TypeError');
    });
  });

  describe('attempts and exhaustion', () => {
    it('leaves the queued set when the job starts, before the reconcile runs', async () => {
      queue.enqueue(5);
      sync.reconcile.mockImplementationOnce(async () => {
        expect(queue.isQueued(5)).toBe(false);

        return { kind: 'done' };
      });

      await build().perform(logger());
    });

    it('counts attempts per perform and flags the last one at maxRetries', async () => {
      const job = build(5, { KERGHAN_ISSUES_SYNC_MAX_RETRIES: '3' });

      respond({ kind: 'transient' }, { kind: 'transient' }, { kind: 'transient' });

      for (let attempt = 1; attempt <= 3; attempt += 1) await job.perform(logger()).catch(() => undefined);

      expect(sync.reconcile.mock.calls).toEqual([
        [5, { lastAttempt: false }],
        [5, { lastAttempt: false }],
        [5, { lastAttempt: true }],
      ]);
    });

    it('a rate-limited job never consumes an attempt-by-failure: it finishes, so the library counts no failure', async () => {
      const job = build(5, { KERGHAN_ISSUES_SYNC_MAX_RETRIES: '2' });

      respond({ kind: 'rate_limited', until: new Date() });
      await expect(job.perform(logger())).resolves.toBeUndefined();
      expect(job.exhausted()).toBe(false);
    });

    it('a transient failure counts toward the library\'s exhaustion', async () => {
      const job = build(5, { KERGHAN_ISSUES_SYNC_MAX_RETRIES: '1' });

      respond({ kind: 'transient' });
      await job.perform(logger()).catch(() => undefined);

      expect(job.exhausted()).toBe(true);
    });
  });

  describe('params and logs', () => {
    it('does nothing for a job without a numeric link id', async () => {
      const log = logger();

      await expect(build('5').perform(log)).resolves.toBeUndefined();
      await expect(build(null).perform(log)).resolves.toBeUndefined();

      expect(sync.reconcile).not.toHaveBeenCalled();
      expect(log.warn).toHaveBeenCalledWith('issues reconcile skipped: no link id');
    });

    it('logs the link id and the outcome kind only', async () => {
      respond({ kind: 'stopped', reason: 'credential' });
      const log = logger();

      await build().perform(log);

      expect(log.info.mock.calls).toEqual([['issues reconcile link=5 outcome=stopped']]);
      expect(log.debug).not.toHaveBeenCalled();
      expect(log.warn).not.toHaveBeenCalled();
      expect(log.error).not.toHaveBeenCalled();
    });

    it('performs without a logger', async () => {
      respond({ kind: 'done' });

      await expect(build().perform()).resolves.toBeUndefined();
    });
  });
});
