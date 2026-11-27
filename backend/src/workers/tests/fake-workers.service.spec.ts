import { Job } from 'deku-swarm';
import { FakeWorkersService } from './support/fake-workers.service.js';

class RecordingJob extends Job {
  static performed: Array<Record<string, unknown>> = [];
  readonly attrs: Record<string, unknown>;

  constructor(params: Record<string, unknown> = {}) {
    super(params);
    this.attrs = params;
  }

  async perform(): Promise<void> {
    RecordingJob.performed.push(this.attrs);
    if (this.attrs.fail === true) throw new Error('boom');
  }
}

describe('FakeWorkersService', () => {
  let workers: FakeWorkersService;

  beforeEach(() => {
    RecordingJob.performed = [];
    workers = new FakeWorkersService();
    workers.register('test.job', RecordingJob, { service: 'injected' });
  });

  it('reports itself running by default', () => {
    expect(workers.isRunning()).toBe(true);
  });

  it('answers whatever running is set to, also after a reset', () => {
    workers.running = false;

    expect(workers.isRunning()).toBe(false);
    expect(workers.reset().isRunning()).toBe(false);
  });

  it('records registrations and every enqueue call, without running anything', () => {
    const id = workers.enqueue('test.job', { linkId: 4 });

    expect(workers.registrations).toEqual([{ name: 'test.job', klass: RecordingJob, attributes: { service: 'injected' } }]);
    expect(workers.enqueued).toEqual([{ id, name: 'test.job', params: { linkId: 4 } }]);
    expect(workers.paramsOf('test.job')).toEqual([{ linkId: 4 }]);
    expect(workers.queued).toBe(1);
    expect(RecordingJob.performed).toEqual([]);
  });

  it('runs captured jobs oldest first with the registered attributes merged under the params', async () => {
    workers.enqueue('test.job', { linkId: 1 });
    workers.enqueue('test.job', { linkId: 2 });

    await workers.runAll();

    expect(RecordingJob.performed.map((attrs) => [attrs.service, attrs.linkId])).toEqual([['injected', 1], ['injected', 2]]);
    expect(workers.queued).toBe(0);
  });

  it('keeps a failing job in errors instead of throwing, and keeps running the rest', async () => {
    workers.enqueue('test.job', { fail: true });
    workers.enqueue('test.job', { linkId: 2 });

    await workers.runAll();

    expect(workers.errors).toHaveLength(1);
    expect(RecordingJob.performed).toHaveLength(2);
  });

  it('runs a job enqueued while running', async () => {
    class ChainJob extends RecordingJob {
      async perform(): Promise<void> {
        await super.perform();
        if (this.attrs.linkId === 1) workers.enqueue('test.job', { linkId: 2 });
      }
    }

    workers.register('chain.job', ChainJob);
    workers.enqueue('chain.job', { linkId: 1 });
    await workers.runAll();

    expect(RecordingJob.performed.map((attrs) => attrs.linkId)).toEqual([1, 2]);
    expect(workers.queued).toBe(0);
  });

  it('fails loudly for a job that was never registered or an empty queue', async () => {
    expect(() => workers.buildNext()).toThrow('no captured job');
    workers.enqueue('unknown.job');
    expect(() => workers.buildNext()).toThrow('no job registered as unknown.job');
  });

  it('hands the performed job a logger whose calls are kept', async () => {
    class LoggingJob extends Job {
      async perform(logger?: { info(message: string): void }): Promise<void> {
        logger?.info('hello');
      }
    }

    workers.register('log.job', LoggingJob);
    workers.enqueue('log.job');
    await workers.runAll();

    expect(workers.logger.calls).toEqual([{ level: 'info', message: 'hello' }]);
    expect(workers.reset().enqueued).toEqual([]);
  });
});
