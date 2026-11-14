import { NOW, useRepositoriesControllerHarness } from './repositoriesControllerHarness.js';

describe('repositoriesControllerHarness support', () => {
  const context = useRepositoriesControllerHarness();

  it('mocks the clock at NOW', () => {
    expect(Date.now()).toBe(NOW);
  });

  it('applies setter values to the state', () => {
    context.setters.setRefreshNotice('hello');

    expect(context.state.refreshNotice).toBe('hello');
  });

  it('applies updater functions to the state', () => {
    context.setters.setListing((current) => ({ ...current, repositories: [1] }));

    expect(context.state.listing.repositories).toEqual([1]);
  });

  it('builds a controller over the spied client', async () => {
    context.client.list.and.resolveTo(undefined);

    await context.buildController().load();

    expect(context.client.list).toHaveBeenCalled();
  });
});
