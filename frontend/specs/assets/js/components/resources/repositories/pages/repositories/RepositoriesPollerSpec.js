import RepositoriesPoller, { POLL_INTERVAL_MS } from '../../../../../../../../assets/js/components/resources/repositories/pages/repositories/RepositoriesPoller.js';
import { flushMicrotasks } from '../../../../../../../support/flushMicrotasks.js';

describe('RepositoriesPoller', () => {
  let tick;
  let poller;

  beforeEach(() => {
    jasmine.clock().install();
    tick = jasmine.createSpy('tick').and.resolveTo(true);
    poller = new RepositoriesPoller(tick);
  });

  afterEach(() => {
    poller.stop();
    jasmine.clock().uninstall();
  });

  it('polls every 2000 ms', async () => {
    poller.start();
    jasmine.clock().tick(POLL_INTERVAL_MS - 1);

    expect(tick).not.toHaveBeenCalled();

    jasmine.clock().tick(1);
    await flushMicrotasks();
    jasmine.clock().tick(POLL_INTERVAL_MS);

    expect(tick).toHaveBeenCalledTimes(2);
    expect(POLL_INTERVAL_MS).toBe(2000);
  });

  it('reports running', () => {
    poller.start();

    expect(poller.running).toBeTrue();
  });

  it('does not start twice', () => {
    poller.start();
    poller.start();
    jasmine.clock().tick(POLL_INTERVAL_MS);

    expect(tick).toHaveBeenCalledTimes(1);
  });

  it('stops when the tick answers false', async () => {
    tick.and.resolveTo(false);
    poller.start();
    jasmine.clock().tick(POLL_INTERVAL_MS);
    await flushMicrotasks();
    jasmine.clock().tick(POLL_INTERVAL_MS * 3);

    expect(tick).toHaveBeenCalledTimes(1);
    expect(poller.running).toBeFalse();
  });

  it('keeps polling after a throwing tick', async () => {
    tick.and.rejectWith(new Error('network'));
    poller.start();
    jasmine.clock().tick(POLL_INTERVAL_MS);
    await flushMicrotasks();
    jasmine.clock().tick(POLL_INTERVAL_MS);

    expect(tick).toHaveBeenCalledTimes(2);
  });

  it('stops on demand', () => {
    poller.start();
    poller.stop();
    jasmine.clock().tick(POLL_INTERVAL_MS * 2);

    expect(tick).not.toHaveBeenCalled();
    expect(poller.running).toBeFalse();
  });

  it('drops the outcome of a tick in flight when stopped', async () => {
    poller.start();
    jasmine.clock().tick(POLL_INTERVAL_MS);
    poller.stop();
    await flushMicrotasks();
    jasmine.clock().tick(POLL_INTERVAL_MS * 2);

    expect(tick).toHaveBeenCalledTimes(1);
  });
});
