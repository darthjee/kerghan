import { useProjectsControllerHarness } from './projectsControllerHarness.js';

describe('projectsControllerHarness support', () => {
  const context = useProjectsControllerHarness('#/projects?page=3');

  it('starts the fake location at the given hash', () => {
    expect(context.location.read()).toBe('#/projects?page=3');
  });

  it('applies pushed and replaced hashes to the fake location', () => {
    context.location.push('#/projects?page=4');
    expect(context.hash).toBe('#/projects?page=4');

    context.location.replace('#/projects');
    expect(context.hash).toBe('#/projects');
  });

  it('builds a controller wired to the spies', async () => {
    context.client.list.and.resolveTo({ projects: [], pagination: { page: 3, totalPages: 0, total: 0 } });

    await context.buildController().start();

    expect(context.setters.setQuery).toHaveBeenCalledWith({ page: 3, search: '' });
  });

  it('applies updater functions to the state', () => {
    context.setters.setListing(() => ({ projects: [1], pagination: null }));

    expect(context.state.listing.projects).toEqual([1]);
  });
});
