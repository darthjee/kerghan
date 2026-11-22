import ProjectsController from '../../assets/js/components/resources/projects/pages/list/controllers/ProjectsController.js';

export const NOW = Date.parse('2026-11-07T12:00:00.000Z');

/**
 * Registers `beforeEach`/`afterEach` hooks setting up a `ProjectsController` harness: a mocked
 * clock at {@link NOW}, setter spies applying values to `context.state`, a spied client, a fake
 * hash location (`context.location`, whose `hash` is `context.hash`) and
 * `context.buildController()`.
 *
 * @param {string} [initialHash] - The hash the fake location starts with.
 * @returns {object} The context, filled in before each spec.
 */
export function useProjectsControllerHarness(initialHash = '#/projects') {
  const context = {};

  const apply = (key) => jasmine.createSpy(key).and.callFake((value) => {
    context.state[key] = typeof value === 'function' ? value(context.state[key]) : value;
  });

  beforeEach(() => {
    jasmine.clock().install();
    jasmine.clock().mockDate(new Date(NOW));
    context.state = {
      listing: { projects: [], pagination: null },
      query: { page: 1, search: '' },
      loadState: { loading: true, error: null },
      notice: undefined,
    };
    context.setters = {
      setListing: apply('listing'),
      setQuery: apply('query'),
      setLoadState: apply('loadState'),
      setNotice: apply('notice'),
    };
    context.client = jasmine.createSpyObj('client', ['list']);
    context.hash = initialHash;
    context.location = {
      read: jasmine.createSpy('read').and.callFake(() => context.hash),
      push: jasmine.createSpy('push').and.callFake((hash) => { context.hash = hash; }),
      replace: jasmine.createSpy('replace').and.callFake((hash) => { context.hash = hash; }),
    };
    context.buildController = () => new ProjectsController(context.setters, context.client, context.location);
  });

  afterEach(() => {
    jasmine.clock().uninstall();
  });

  return context;
}
