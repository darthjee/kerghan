import ApiError from '../../../../../../../../assets/js/client/ApiError.js';
import { useRepositoriesControllerHarness } from '../../../../../../../support/repositoriesControllerHarness.js';
import { flushMicrotasks } from '../../../../../../../support/flushMicrotasks.js';
import {
  buildListing, buildRepository, buildSyncState,
} from '../../../../../../../support/repositoriesBuilders.js';

describe('RepositoriesController polling', () => {
  const context = useRepositoriesControllerHarness();
  const syncing = buildSyncState({ state: 'syncing', startedAt: '2026-11-07T12:00:00Z' });
  let controller;

  const startPolling = async () => {
    context.client.list.and.resolveTo(buildListing({ sync: syncing }));
    controller = context.buildController();
    await controller.load();
    context.client.list.calls.reset();
  };

  const pollOnce = async () => {
    jasmine.clock().tick(2000);
    await flushMicrotasks();
    await flushMicrotasks();
  };

  afterEach(() => controller.dispose());

  it('does not poll while idle', async () => {
    context.client.list.and.resolveTo(buildListing());
    controller = context.buildController();
    await controller.load();
    jasmine.clock().tick(10000);

    expect(context.client.syncState).not.toHaveBeenCalled();
  });

  it('polls the sync state every 2 s while syncing', async () => {
    await startPolling();
    context.client.syncState.and.resolveTo(syncing);

    await pollOnce();
    await pollOnce();

    expect(context.client.syncState).toHaveBeenCalledTimes(2);
  });

  it('stores the sync state without touching the rows while syncing', async () => {
    await startPolling();
    const rowsBefore = context.setters.setListing.calls.count();
    context.client.syncState.and.resolveTo(syncing);

    await pollOnce();

    expect(context.setters.setListing.calls.count()).toBe(rowsBefore);
    expect(context.client.list).not.toHaveBeenCalled();
  });

  it('stops and reloads the page once idle', async () => {
    await startPolling();
    const idle = buildSyncState();
    context.client.syncState.and.resolveTo(idle);
    context.client.list.and.resolveTo(buildListing({ repositories: [buildRepository()], sync: idle }));

    await pollOnce();
    await pollOnce();

    expect(context.client.syncState).toHaveBeenCalledTimes(1);
    expect(context.client.list).toHaveBeenCalledTimes(1);
    expect(context.state.sync.state).toBe('idle');
  });

  it('stops on a 401 (undefined state)', async () => {
    await startPolling();
    context.client.syncState.and.resolveTo(undefined);

    await pollOnce();
    await pollOnce();

    expect(context.client.syncState).toHaveBeenCalledTimes(1);
  });

  it('keeps polling after a transient error', async () => {
    await startPolling();
    context.client.syncState.and.rejectWith(new ApiError(503, 'Unavailable'));

    await pollOnce();
    await pollOnce();

    expect(context.client.syncState).toHaveBeenCalledTimes(2);
  });

  it('stops on dispose', async () => {
    await startPolling();
    context.client.syncState.and.resolveTo(syncing);

    controller.dispose();
    await pollOnce();

    expect(context.client.syncState).not.toHaveBeenCalled();
  });

  it('ignores a poll that lands after disposal', async () => {
    await startPolling();
    let resolve;
    context.client.syncState.and.returnValue(new Promise((done) => { resolve = done; }));
    jasmine.clock().tick(2000);

    controller.dispose();
    resolve(buildSyncState());
    await flushMicrotasks();

    expect(context.client.list).not.toHaveBeenCalled();
  });
});
