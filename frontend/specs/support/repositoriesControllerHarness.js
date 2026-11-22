import RepositoriesController, { INITIAL_QUERY } from '../../assets/js/components/resources/repositories/pages/controllers/RepositoriesController.js';

export const NOW = Date.parse('2026-11-07T12:00:00.000Z');

/**
 * Registers `beforeEach`/`afterEach` hooks setting up a `RepositoriesController` harness: a
 * mocked clock at {@link NOW}, setter spies applying values (or updaters) to `context.state`, a
 * spied client, a spied Projects client, a spied hash location, and `context.buildController()`.
 *
 * @returns {object} The context, filled in before each spec.
 */
export function useRepositoriesControllerHarness() {
  const context = {};

  const apply = (key) => jasmine.createSpy(key).and.callFake((value) => {
    context.state[key] = typeof value === 'function' ? value(context.state[key]) : value;
  });

  beforeEach(() => {
    jasmine.clock().install();
    jasmine.clock().mockDate(new Date(NOW));
    context.state = {
      listing: { repositories: [], pagination: null },
      sync: null,
      query: { ...INITIAL_QUERY },
      loadState: { loading: true, error: null },
      addState: new Map(),
      projectState: new Map(),
      dismissed: new Set(),
      refreshNotice: null,
      now: NOW,
      cooldownUntil: null,
    };
    context.setters = {
      setListing: apply('listing'),
      setSync: apply('sync'),
      setQuery: apply('query'),
      setLoadState: apply('loadState'),
      setAddState: apply('addState'),
      setProjectState: apply('projectState'),
      setDismissed: apply('dismissed'),
      setRefreshNotice: apply('refreshNotice'),
      setNow: apply('now'),
      setCooldownUntil: apply('cooldownUntil'),
    };
    context.client = jasmine.createSpyObj('client', ['list', 'syncState', 'refresh', 'add']);
    context.projectsClient = jasmine.createSpyObj('projectsClient', ['createFromRepository']);
    context.location = jasmine.createSpyObj('location', ['push', 'replace', 'read']);
    context.buildController = () => new RepositoriesController(
      context.setters, context.client, context.projectsClient, context.location,
    );
  });

  afterEach(() => {
    jasmine.clock().uninstall();
  });

  return context;
}
