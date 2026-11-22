import { LIST_HASH, useIssuesControllerHarness } from './issuesControllerHarness.js';

describe('useIssuesControllerHarness', () => {
  const context = useIssuesControllerHarness();

  it('builds a controller over the spied client and the fake location', async () => {
    context.client.list.and.resolveTo({ issues: [], pagination: { page: 1, totalPages: 0 } });

    await context.buildController().start();

    expect(context.client.list).toHaveBeenCalledTimes(1);
    expect(context.location.read).toHaveBeenCalled();
    expect(context.hash).toBe(LIST_HASH);
  });

  it('applies setter values to the state', () => {
    context.setters.setQuery({ state: 'all', page: 2, search: '' });

    expect(context.state.query.page).toBe(2);
  });
});
