import { FakeWorkersService } from '../../workers/tests/support/fake-workers.service.js';
import { EnqueueIssueSyncTrigger } from '../issue-sync-enqueuer.js';
import { IssueSyncQueue } from '../issue-sync-queue.js';
import { ISSUES_RECONCILE_JOB } from '../jobs/issues-reconcile.job.js';

describe('IssueSyncQueue', () => {
  let workers: FakeWorkersService;
  let logger: { error: jest.Mock };
  let queue: IssueSyncQueue;

  beforeEach(() => {
    workers = new FakeWorkersService();
    logger = { error: jest.fn() };
    queue = new IssueSyncQueue(workers as never, logger as never);
  });

  it('enqueues the reconcile job with { linkId } and nothing else', () => {
    queue.enqueue(7);

    expect(workers.enqueued.map(({ name, params }) => [name, params])).toEqual([[ISSUES_RECONCILE_JOB, { linkId: 7 }]]);
    expect(Object.keys(workers.enqueued[0].params)).toEqual(['linkId']);
    expect(queue.isQueued(7)).toBe(true);
  });

  it('is a no-op while the same link is queued and not yet started', () => {
    queue.enqueue(7);
    queue.enqueue(7);
    queue.enqueue(7);

    expect(workers.enqueued).toHaveLength(1);
  });

  it('queues different links independently: a burst of edits leaves one waiting job per link', () => {
    for (const linkId of [1, 2, 1, 3, 2, 1]) queue.enqueue(linkId);

    expect(workers.paramsOf(ISSUES_RECONCILE_JOB)).toEqual([{ linkId: 1 }, { linkId: 2 }, { linkId: 3 }]);
  });

  it('enqueues again once the link\'s job started (an edit during a running job)', () => {
    queue.enqueue(7);
    queue.started(7);

    expect(queue.isQueued(7)).toBe(false);

    queue.enqueue(7);

    expect(workers.enqueued).toHaveLength(2);
  });

  it('forgets a link whose enqueue failed, logs the error class only and never throws', () => {
    jest.spyOn(workers, 'enqueue').mockImplementationOnce(() => {
      throw new RangeError('secret detail');
    });

    expect(() => queue.enqueue(7)).not.toThrow();
    expect(queue.isQueued(7)).toBe(false);
    expect(logger.error).toHaveBeenCalledWith('issues reconcile enqueue failed', {
      context: 'IssueSyncQueue',
      linkId: 7,
      errorClass: 'RangeError',
    });

    queue.enqueue(7);
    expect(workers.enqueued).toHaveLength(1);
  });

  it('logs a non-error throw by its type', () => {
    jest.spyOn(workers, 'enqueue').mockImplementationOnce(() => {
      throw 'boom'; // eslint-disable-line @typescript-eslint/only-throw-error
    });

    queue.enqueue(1);

    expect(logger.error).toHaveBeenCalledWith('issues reconcile enqueue failed', expect.objectContaining({ errorClass: 'string' }));
  });
});

describe('EnqueueIssueSyncTrigger (T1)', () => {
  it('enqueues each bumped link through the queue', () => {
    const queue = { enqueue: jest.fn() };

    new EnqueueIssueSyncTrigger(queue).afterCommit([3, 4]);

    expect(queue.enqueue.mock.calls).toEqual([[3], [4]]);
  });

  it('enqueues nothing for no links', () => {
    const queue = { enqueue: jest.fn() };

    new EnqueueIssueSyncTrigger(queue).afterCommit([]);

    expect(queue.enqueue).not.toHaveBeenCalled();
  });
});
