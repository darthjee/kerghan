import BoundedRereadController, { shouldReread } from '../../../../../../../assets/js/components/resources/issues/sync/BoundedRereadController.js';
import ApiError from '../../../../../../../assets/js/client/ApiError.js';
import { buildIssue, buildLink } from '../../../../../../support/issuesBuilders.js';
import { flushMicrotasks } from '../../../../../../support/flushMicrotasks.js';

describe('BoundedRereadController', () => {
  let read;
  let onIssue;
  let onDone;
  let onNotFound;
  let controller;
  const trigger = buildIssue({ link: buildLink({ state: 'pending', states: ['pending'], lastSyncedAt: '2026-11-07T11:00:00.000Z' }) });
  const unchanged = () => buildIssue({ link: buildLink({ state: 'pending', states: ['pending'], lastSyncedAt: '2026-11-07T11:00:00.000Z' }) });

  const advance = async (ms) => {
    jasmine.clock().tick(ms);
    await flushMicrotasks();
  };

  beforeEach(() => {
    jasmine.clock().install();
    read = jasmine.createSpy('read').and.callFake(async () => unchanged());
    onIssue = jasmine.createSpy('onIssue');
    onDone = jasmine.createSpy('onDone');
    onNotFound = jasmine.createSpy('onNotFound');
    controller = new BoundedRereadController({ read, onIssue, onDone, onNotFound });
  });

  afterEach(() => {
    controller.dispose();
    jasmine.clock().uninstall();
  });

  describe('shouldReread', () => {
    it('is true for a linked issue', () => {
      expect(shouldReread(buildIssue({ link: buildLink() }))).toBeTrue();
    });

    it('is false for an unlinked, gone or missing issue', () => {
      expect(shouldReread(buildIssue())).toBeFalse();
      expect(shouldReread(buildIssue({ link: buildLink({ state: 'gone' }) }))).toBeFalse();
      expect(shouldReread(undefined)).toBeFalse();
    });
  });

  it('reads at 2 s, 5 s and 10 s and stops quietly after the third', async () => {
    expect(controller.start(trigger)).toBeTrue();

    await advance(1999);
    expect(read).not.toHaveBeenCalled();
    await advance(1);
    expect(read).toHaveBeenCalledTimes(1);
    await advance(3000);
    expect(read).toHaveBeenCalledTimes(2);
    expect(onDone).not.toHaveBeenCalled();
    await advance(5000);
    expect(read).toHaveBeenCalledTimes(3);
    expect(onIssue).toHaveBeenCalledTimes(3);
    expect(onDone).toHaveBeenCalledTimes(1);
    expect(onNotFound).not.toHaveBeenCalled();

    await advance(20000);
    expect(read).toHaveBeenCalledTimes(3);
  });

  it('stops early on a later lastSyncedAt', async () => {
    read.and.callFake(async () => buildIssue({ link: buildLink({ state: 'pending', states: ['pending'], lastSyncedAt: '2026-11-07T11:00:05.000Z' }) }));
    controller.start(trigger);

    await advance(2000);
    await advance(20000);

    expect(read).toHaveBeenCalledTimes(1);
    expect(onDone).toHaveBeenCalledTimes(1);
  });

  it('stops early when lastSyncedAt appears after a null one', async () => {
    read.and.callFake(async () => buildIssue({ link: buildLink({ states: ['pending'], lastSyncedAt: '2026-11-07T11:00:05.000Z' }) }));
    controller.start(buildIssue({ link: buildLink({ states: ['pending'], lastSyncedAt: null }) }));

    await advance(2000);

    expect(onDone).toHaveBeenCalledTimes(1);
  });

  it('stops early when the states differ', async () => {
    read.and.callFake(async () => buildIssue({ link: buildLink({ state: 'linked', states: ['linked'], lastSyncedAt: '2026-11-07T11:00:00.000Z' }) }));
    controller.start(trigger);

    await advance(2000);
    await advance(20000);

    expect(read).toHaveBeenCalledTimes(1);
    expect(onIssue).toHaveBeenCalledTimes(1);
    expect(onDone).toHaveBeenCalledTimes(1);
  });

  it('stops early when the states differ in content at the same length', async () => {
    read.and.callFake(async () => buildIssue({ link: buildLink({ states: ['rate_limited'], lastSyncedAt: '2026-11-07T11:00:00.000Z' }) }));
    controller.start(trigger);

    await advance(2000);

    expect(onDone).toHaveBeenCalledTimes(1);
  });

  it('stops when the read issue is gone', async () => {
    read.and.callFake(async () => buildIssue({ link: buildLink({ state: 'gone', states: ['pending'], lastSyncedAt: '2026-11-07T11:00:00.000Z' }) }));
    controller.start(trigger);

    await advance(2000);

    expect(onDone).toHaveBeenCalledTimes(1);
  });

  it('reports a 404 and stops', async () => {
    read.and.callFake(async () => { throw new ApiError(404, 'Not found'); });
    controller.start(trigger);

    await advance(2000);
    await advance(20000);

    expect(onNotFound).toHaveBeenCalledTimes(1);
    expect(onDone).toHaveBeenCalledTimes(1);
    expect(read).toHaveBeenCalledTimes(1);
  });

  it('ignores other errors and keeps reading', async () => {
    read.and.callFake(async () => { throw new ApiError(500, 'Boom'); });
    controller.start(trigger);

    await advance(2000);
    await advance(3000);
    await advance(5000);

    expect(read).toHaveBeenCalledTimes(3);
    expect(onNotFound).not.toHaveBeenCalled();
    expect(onIssue).not.toHaveBeenCalled();
    expect(onDone).toHaveBeenCalledTimes(1);
  });

  it('skips an empty answer (the session expired) and keeps reading', async () => {
    read.and.callFake(async () => undefined);
    controller.start(trigger);

    await advance(2000);

    expect(onIssue).not.toHaveBeenCalled();
    expect(onDone).not.toHaveBeenCalled();
    await advance(8000);
    expect(read).toHaveBeenCalledTimes(3);
    expect(onDone).toHaveBeenCalledTimes(1);
  });

  it('does nothing for an unlinked or gone issue', async () => {
    expect(controller.start(buildIssue())).toBeFalse();
    expect(controller.start(buildIssue({ link: buildLink({ state: 'gone' }) }))).toBeFalse();

    await advance(20000);

    expect(read).not.toHaveBeenCalled();
  });

  it('clears the timers on dispose', async () => {
    controller.start(trigger);
    controller.dispose();

    await advance(20000);

    expect(read).not.toHaveBeenCalled();
    expect(onDone).not.toHaveBeenCalled();
  });

  it('ignores a read in flight when disposed', async () => {
    let resolve;
    read.and.callFake(() => new Promise((r) => { resolve = r; }));
    controller.start(trigger);
    await advance(2000);
    controller.dispose();
    resolve(buildIssue({ link: buildLink({ states: ['linked'] }) }));
    await flushMicrotasks();

    expect(onIssue).not.toHaveBeenCalled();
  });

  it('ignores a 404 in flight when disposed', async () => {
    let reject;
    read.and.callFake(() => new Promise((_, r) => { reject = r; }));
    controller.start(trigger);
    await advance(2000);
    controller.dispose();
    reject(new ApiError(404, 'Not found'));
    await flushMicrotasks();

    expect(onNotFound).not.toHaveBeenCalled();
  });

  it('restarts a running re-read', async () => {
    controller.start(trigger);
    await advance(1000);
    controller.start(trigger);
    await advance(1500);

    expect(read).not.toHaveBeenCalled();
    await advance(500);
    expect(read).toHaveBeenCalledTimes(1);
  });

  it('works without onDone and onNotFound', async () => {
    const bare = new BoundedRereadController({ read, onIssue });

    read.and.callFake(async () => { throw new ApiError(404, 'x'); });
    bare.start(trigger);

    await advance(2000);

    expect(onIssue).not.toHaveBeenCalled();
    bare.dispose();
  });
});
