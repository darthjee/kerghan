import { FakeWorkersService } from '../../workers/tests/support/fake-workers.service.js';
import { IssueSyncQueue } from '../issue-sync-queue.js';
import { IssuesSyncBootstrap } from '../issues-sync.bootstrap.js';
import { ISSUES_RECONCILE_JOB, IssuesReconcileJob } from '../jobs/issues-reconcile.job.js';

describe('IssuesSyncBootstrap', () => {
  let workers: FakeWorkersService;
  let queue: IssueSyncQueue;
  let markers: { listForBoot: jest.Mock };
  let logger: { error: jest.Mock };
  let sync: object;
  let config: object;
  let bootstrap: IssuesSyncBootstrap;

  beforeEach(() => {
    workers = new FakeWorkersService();
    logger = { error: jest.fn() };
    queue = new IssueSyncQueue(workers as never, logger as never);
    markers = { listForBoot: jest.fn(async () => []) };
    sync = { reconcile: jest.fn() };
    config = { syncMaxRetries: 5, syncCooldownMs: 30_000 };
    bootstrap = new IssuesSyncBootstrap(workers as never, sync as never, queue, config as never, markers as never, logger as never);
  });

  it('registers issues.reconcile once, with the sync service, the queue and the config as attributes only', () => {
    bootstrap.onModuleInit();

    expect(workers.registrations).toEqual([
      { name: ISSUES_RECONCILE_JOB, klass: IssuesReconcileJob, attributes: { sync, queue, config } },
    ]);
    expect(Object.keys(workers.registrations[0].attributes).sort()).toEqual(['config', 'queue', 'sync']);
  });

  it('T5: enqueues one reconcile per marker, in the order the markers are listed (oldest first), with no filtering', async () => {
    markers.listForBoot.mockResolvedValue([9, 4, 6]);

    await bootstrap.onApplicationBootstrap();

    expect(workers.paramsOf(ISSUES_RECONCILE_JOB)).toEqual([{ linkId: 9 }, { linkId: 4 }, { linkId: 6 }]);
  });

  it('T5: enqueues nothing when there is no marker', async () => {
    await bootstrap.onApplicationBootstrap();

    expect(workers.enqueued).toEqual([]);
  });

  it('T5: a failing read is logged with the error class only and never stops the boot', async () => {
    markers.listForBoot.mockRejectedValue(new TypeError('secret detail'));

    await expect(bootstrap.onApplicationBootstrap()).resolves.toBeUndefined();
    expect(logger.error).toHaveBeenCalledWith('issues boot sweep failed', { context: 'IssuesSyncBootstrap', errorClass: 'TypeError' });
  });

  it('logs a non-error throw by its type', async () => {
    markers.listForBoot.mockRejectedValue('boom');

    await bootstrap.onApplicationBootstrap();

    expect(logger.error).toHaveBeenCalledWith('issues boot sweep failed', expect.objectContaining({ errorClass: 'string' }));
  });
});
