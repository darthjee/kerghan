import IssuesController from '../../assets/js/components/resources/issues/list/controllers/IssuesController.js';
import { PROJECT_ID } from './issuesBuilders.js';

export const NOW = Date.parse('2026-11-07T12:00:00.000Z');

/** The hash of the project page, the issue list's own. */
export const LIST_HASH = `#/projects/${PROJECT_ID}`;

/**
 * Registers `beforeEach`/`afterEach` hooks setting up an `IssuesController` harness: a mocked
 * clock at {@link NOW}, setter spies applying values to `context.state`, a spied client, a fake
 * hash location (`context.location`, whose `hash` is `context.hash`) and
 * `context.buildController()`.
 *
 * @param {string} [initialHash] - The hash the fake location starts with.
 * @returns {object} The context, filled in before each spec.
 */
export function useIssuesControllerHarness(initialHash = LIST_HASH) {
  const context = {};

  const apply = (key) => jasmine.createSpy(key).and.callFake((value) => {
    context.state[key] = typeof value === 'function' ? value(context.state[key]) : value;
  });

  beforeEach(() => {
    jasmine.clock().install();
    jasmine.clock().mockDate(new Date(NOW));
    context.state = {
      listing: { issues: [], pagination: null },
      query: { state: 'open', page: 1, search: '' },
      loadState: { loading: true, error: null },
    };
    context.setters = {
      setListing: apply('listing'),
      setQuery: apply('query'),
      setLoadState: apply('loadState'),
    };
    context.client = jasmine.createSpyObj('client', ['list']);
    context.hash = initialHash;
    context.location = {
      read: jasmine.createSpy('read').and.callFake(() => context.hash),
      push: jasmine.createSpy('push').and.callFake((hash) => { context.hash = hash; }),
      replace: jasmine.createSpy('replace').and.callFake((hash) => { context.hash = hash; }),
    };
    context.buildController = () => new IssuesController(
      context.setters, PROJECT_ID, context.client, context.location,
    );
  });

  afterEach(() => {
    jasmine.clock().uninstall();
  });

  return context;
}
