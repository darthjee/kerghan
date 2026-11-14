import ApiError from '../../../../../../../../assets/js/client/ApiError.js';
import { useRepositoriesControllerHarness } from '../../../../../../../support/repositoriesControllerHarness.js';
import { flushMicrotasks } from '../../../../../../../support/flushMicrotasks.js';
import { buildListing, buildRepository } from '../../../../../../../support/repositoriesBuilders.js';

const noop = Function.prototype;

describe('RepositoriesController add', () => {
  const context = useRepositoriesControllerHarness();
  const row = buildRepository({ githubId: 7 });
  let controller;

  beforeEach(() => {
    controller = context.buildController();
    context.state.listing = { repositories: [row, buildRepository({ githubId: 8 })], pagination: null };
  });

  it('shows a pending state while the request runs', () => {
    context.client.add.and.returnValue(new Promise(noop));

    controller.add(7);

    expect(context.state.addState.get(7)).toEqual({ status: 'pending' });
  });

  it('sends the githubId', async () => {
    context.client.add.and.resolveTo({ githubId: 7, status: 'added' });

    await controller.add(7);

    expect(context.client.add).toHaveBeenCalledWith(7);
  });

  it('marks the row added in place and clears its Add state', async () => {
    context.client.add.and.resolveTo({ githubId: 7, status: 'added', addedAt: 'T' });

    await controller.add(7);

    expect(context.state.addState.has(7)).toBeFalse();
    expect(context.state.listing.repositories[0]).toEqual(
      jasmine.objectContaining({ githubId: 7, status: 'added', addedAt: 'T', fullName: 'darthjee/kerghan' }),
    );
    expect(context.state.listing.repositories[1].status).toBe('not_added');
  });

  it('only clears the Add state when the session expired', async () => {
    context.client.add.and.resolveTo(undefined);

    await controller.add(7);

    expect(context.state.addState.has(7)).toBeFalse();
    expect(context.state.listing.repositories[0].status).toBe('not_added');
  });

  [
    [new ApiError(404, 'x', 'NOT_FOUND'), 'Repository not found on GitHub.'],
    [new ApiError(502, 'x'), 'GitHub is unavailable or rate limited — try again later.'],
    [new ApiError(503, 'x'), 'GitHub is unavailable or rate limited — try again later.'],
    [new ApiError(429, 'x', 'C', undefined, undefined, 9), 'Too many repositories added — try again in 9 s.'],
  ].forEach(([error, message]) => {
    it(`shows "${message}" for a ${error.status}`, async () => {
      context.client.add.and.rejectWith(error);

      await controller.add(7);

      expect(context.state.addState.get(7)).toEqual({ status: 'error', message });
    });
  });

  it('shows the Integrations link for a 409 REPOSITORY_SOURCE_UNUSABLE', async () => {
    context.client.add.and.rejectWith(new ApiError(409, 'x', 'REPOSITORY_SOURCE_UNUSABLE'));

    await controller.add(7);

    expect(context.state.addState.get(7).link.href).toBe('#/account/integrations');
  });

  it('keeps the Add state across a reload', async () => {
    context.client.add.and.returnValue(new Promise(noop));
    context.client.list.and.resolveTo(buildListing({ repositories: [row] }));
    controller.add(7);

    await controller.load();
    await flushMicrotasks();

    expect(context.state.addState.get(7)).toEqual({ status: 'pending' });
  });

  it('keeps an added row visible until the next reload', async () => {
    context.state.query = { page: 1, filter: 'not_added', search: '' };
    context.client.add.and.resolveTo({ githubId: 7, status: 'added' });

    await controller.add(7);

    expect(context.state.listing.repositories.map((repository) => repository.githubId)).toEqual([7, 8]);
  });
});
