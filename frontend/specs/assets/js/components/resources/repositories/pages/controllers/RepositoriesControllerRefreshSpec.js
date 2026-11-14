import ApiError from '../../../../../../../../assets/js/client/ApiError.js';
import { NOW, useRepositoriesControllerHarness } from '../../../../../../../support/repositoriesControllerHarness.js';
import { buildSyncState } from '../../../../../../../support/repositoriesBuilders.js';

describe('RepositoriesController refresh', () => {
  const context = useRepositoriesControllerHarness();
  let controller;

  beforeEach(() => {
    controller = context.buildController();
  });

  afterEach(() => controller.dispose());

  it('stores the returned sync state and starts polling', async () => {
    const syncing = buildSyncState({ state: 'syncing' });
    context.client.refresh.and.resolveTo(syncing);
    context.client.syncState.and.resolveTo(syncing);

    await controller.refresh();
    jasmine.clock().tick(2000);

    expect(context.state.sync).toEqual(syncing);
    expect(context.client.syncState).toHaveBeenCalled();
  });

  it('clears the previous notice', async () => {
    context.state.refreshNotice = 'old';
    context.client.refresh.and.resolveTo(buildSyncState());

    await controller.refresh();

    expect(context.state.refreshNotice).toBeNull();
  });

  it('leaves state alone when the session expired', async () => {
    context.client.refresh.and.resolveTo(undefined);

    await controller.refresh();

    expect(context.setters.setSync).not.toHaveBeenCalled();
  });

  it('starts the countdown from the sync state', async () => {
    const until = '2026-11-07T12:05:00Z';
    context.client.refresh.and.resolveTo(buildSyncState({ state: 'syncing', refreshAvailableAt: until }));

    await controller.refresh();
    jasmine.clock().tick(1000);

    expect(context.state.cooldownUntil).toBe(Date.parse(until));
    expect(context.state.now).toBe(NOW + 1000);
  });

  describe('on a 429', () => {
    const cooldown = (seconds) => new ApiError(
      429, 'x', 'REPOSITORY_REFRESH_COOLDOWN', undefined, undefined, seconds,
    );

    it('shows the notice with the seconds', async () => {
      context.client.refresh.and.rejectWith(cooldown(30));

      await controller.refresh();

      expect(context.state.refreshNotice)
        .toBe('Repositories were synced recently. Try again in 30 s.');
    });

    it('adopts the delay as the countdown target', async () => {
      context.client.refresh.and.rejectWith(cooldown(30));

      await controller.refresh();
      jasmine.clock().tick(1000);

      expect(context.state.cooldownUntil).toBe(NOW + 30000);
      expect(context.state.now).toBe(NOW + 1000);
    });

    it('shows a generic notice without a delay', async () => {
      context.client.refresh.and.rejectWith(cooldown(undefined));

      await controller.refresh();

      expect(context.state.refreshNotice).toBe('Repositories were synced recently. Try again shortly.');
      expect(context.setters.setCooldownUntil).not.toHaveBeenCalled();
    });
  });

  it('shows the error message of any other failure', async () => {
    context.client.refresh.and.rejectWith(new ApiError(500, 'Boom'));

    await controller.refresh();

    expect(context.state.refreshNotice).toBe('Boom');
  });

  it('falls back to a generic message', async () => {
    context.client.refresh.and.rejectWith({});

    await controller.refresh();

    expect(context.state.refreshNotice).toBe('Request failed');
  });
});
