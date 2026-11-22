import ApiError from '../../../../../../../../assets/js/client/ApiError.js';
import ProjectRefreshController from '../../../../../../../../assets/js/components/resources/projects/pages/show/ProjectRefreshController.js';
import { PROJECT_ID } from '../../../../../../../support/issuesBuilders.js';

describe('ProjectRefreshController', () => {
  let state;
  let client;
  let onReloadList;
  let onReloadProject;
  let controller;

  beforeEach(() => {
    jasmine.clock().install();
    state = { refreshing: [], notice: undefined, error: undefined };
    client = jasmine.createSpyObj('client', ['refresh']);
    client.refresh.and.resolveTo({ enqueued: 3, skippedFresh: 2 });
    onReloadList = jasmine.createSpy('onReloadList');
    onReloadProject = jasmine.createSpy('onReloadProject');
    controller = new ProjectRefreshController({
      setRefreshing: (value) => state.refreshing.push(value),
      setNotice: (value) => { state.notice = value; },
      setError: (value) => { state.error = value; },
      onReloadList,
      onReloadProject,
    }, client);
  });

  afterEach(() => {
    controller.dispose();
    jasmine.clock().uninstall();
  });

  const lastRefreshing = () => state.refreshing[state.refreshing.length - 1];

  it('shows "Refreshing N issues (M already up to date)" and keeps the button disabled until the re-read', async () => {
    await controller.refresh(PROJECT_ID);

    expect(client.refresh).toHaveBeenCalledOnceWith(PROJECT_ID);
    expect(state.notice).toBe('Refreshing 3 issues (2 already up to date)');
    expect(lastRefreshing()).toBeTrue();
    expect(onReloadList).not.toHaveBeenCalled();
  });

  it('re-reads the list once, about 10 s later, and re-enables the button', async () => {
    await controller.refresh(PROJECT_ID);

    jasmine.clock().tick(9999);
    expect(onReloadList).not.toHaveBeenCalled();
    jasmine.clock().tick(1);
    expect(onReloadList).toHaveBeenCalledTimes(1);
    expect(lastRefreshing()).toBeFalse();

    jasmine.clock().tick(60000);
    expect(onReloadList).toHaveBeenCalledTimes(1);
  });

  it('shows "Everything is up to date" when nothing was enqueued, with the same single re-read', async () => {
    client.refresh.and.resolveTo({ enqueued: 0, skippedFresh: 5 });

    await controller.refresh(PROJECT_ID);
    jasmine.clock().tick(10000);

    expect(state.notice).toBe('Everything is up to date');
    expect(onReloadList).toHaveBeenCalledTimes(1);
  });

  it('U2: ignores a second click while in flight and while waiting for the re-read', async () => {
    await controller.refresh(PROJECT_ID);
    await controller.refresh(PROJECT_ID);

    expect(client.refresh).toHaveBeenCalledTimes(1);

    jasmine.clock().tick(10000);
    await controller.refresh(PROJECT_ID);

    expect(client.refresh).toHaveBeenCalledTimes(2);
  });

  ['PROJECT_HAS_NO_REPOSITORY', 'PROJECT_REPOSITORY_UNAVAILABLE'].forEach((code) => {
    it(`shows the message of ${code} and re-reads the project`, async () => {
      client.refresh.and.rejectWith(new ApiError(409, 'No repository', code));

      await controller.refresh(PROJECT_ID);

      expect(state.error.message).toBe('No repository');
      expect(onReloadProject).toHaveBeenCalledTimes(1);
      expect(lastRefreshing()).toBeFalse();
      expect(onReloadList).not.toHaveBeenCalled();
    });
  });

  it('passes a rate limit with its retryAfterSeconds on, without re-reading the project', async () => {
    client.refresh.and.rejectWith(new ApiError(429, 'Slow', 'GITHUB_RATE_LIMITED', undefined, 5, 9));

    await controller.refresh(PROJECT_ID);

    expect(state.error).toEqual({ message: 'Slow', retryAfterSeconds: 9 });
    expect(onReloadProject).not.toHaveBeenCalled();
  });

  it('re-reads the project on a 404, which then shows "Project not found"', async () => {
    client.refresh.and.rejectWith(new ApiError(404, 'Not found', 'NOT_FOUND'));

    await controller.refresh(PROJECT_ID);

    expect(onReloadProject).toHaveBeenCalledTimes(1);
    expect(state.error).toBeNull();
  });

  it('changes nothing when the session expired', async () => {
    client.refresh.and.resolveTo(undefined);

    await controller.refresh(PROJECT_ID);

    expect(state.notice).toBeNull();
    expect(lastRefreshing()).toBeFalse();
  });

  it('clears the timer on dispose (navigation)', async () => {
    await controller.refresh(PROJECT_ID);
    controller.dispose();
    jasmine.clock().tick(20000);

    expect(onReloadList).not.toHaveBeenCalled();
  });
});
