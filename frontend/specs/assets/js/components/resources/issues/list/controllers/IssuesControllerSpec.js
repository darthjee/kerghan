import IssuesController, { SEARCH_DEBOUNCE_MS } from '../../../../../../../../assets/js/components/resources/issues/list/controllers/IssuesController.js';
import { flushMicrotasks } from '../../../../../../../support/flushMicrotasks.js';
import {
  buildIssue, buildIssueListing, PROJECT_ID,
} from '../../../../../../../support/issuesBuilders.js';
import { LIST_HASH, useIssuesControllerHarness } from '../../../../../../../support/issuesControllerHarness.js';

describe('IssuesController', () => {
  const context = useIssuesControllerHarness();
  const request = (overrides) => [PROJECT_ID, { state: 'open', search: '', page: 1, perPage: 50, ...overrides }];

  beforeEach(() => {
    context.client.list.and.resolveTo(buildIssueListing());
  });

  describe('#start', () => {
    it('loads the first open page and stores the rows, pagination and load state', async () => {
      await context.buildController().start();

      expect(context.client.list).toHaveBeenCalledOnceWith(...request());
      expect(context.state.listing.issues.length).toBe(1);
      expect(context.state.listing.pagination.total).toBe(1);
      expect(context.state.loadState).toEqual({ loading: false, error: null });
    });

    it('does not touch state when the session expired (undefined answer)', async () => {
      context.client.list.and.resolveTo(undefined);

      await context.buildController().start();

      expect(context.setters.setListing).not.toHaveBeenCalled();
      expect(context.setters.setLoadState).not.toHaveBeenCalled();
    });

    it('restores state, search and page from the hash (reload)', async () => {
      context.hash = `${LIST_HASH}?state=closed&search=login&page=2`;

      await context.buildController().start();

      expect(context.client.list).toHaveBeenCalledOnceWith(...request({ state: 'closed', search: 'login', page: 2 }));
      expect(context.state.query).toEqual({ state: 'closed', search: 'login', page: 2 });
      expect(context.location.replace).not.toHaveBeenCalled();
    });

    it('requests the all state', async () => {
      context.hash = `${LIST_HASH}?state=all`;

      await context.buildController().start();

      expect(context.client.list).toHaveBeenCalledOnceWith(...request({ state: 'all' }));
    });
  });

  describe('U6: invalid hash query', () => {
    it('normalizes state=foo and page=-1 before calling, rewriting the hash', async () => {
      context.hash = `${LIST_HASH}?state=foo&page=-1`;

      await context.buildController().start();

      expect(context.client.list).toHaveBeenCalledOnceWith(...request());
      expect(context.location.replace).toHaveBeenCalledWith(LIST_HASH);
    });

    it('truncates a search over 100 characters', async () => {
      context.hash = `${LIST_HASH}?search=${'x'.repeat(150)}`;

      await context.buildController().start();

      expect(context.client.list).toHaveBeenCalledOnceWith(...request({ search: 'x'.repeat(100) }));
      expect(context.state.query.search.length).toBe(100);
    });
  });

  describe('load errors', () => {
    it('shows the error message', async () => {
      context.client.list.and.rejectWith(new Error('Server exploded'));

      await context.buildController().start();

      expect(context.state.loadState).toEqual({ loading: false, error: 'Server exploded' });
    });

    it('falls back to a generic message', async () => {
      context.client.list.and.rejectWith({});

      await context.buildController().start();

      expect(context.state.loadState.error).toBe('Could not load the issues.');
    });

    it('retries: shows loading, then the rows', async () => {
      context.client.list.and.rejectWith(new Error('nope'));
      const controller = context.buildController();
      await controller.start();
      context.client.list.and.resolveTo(buildIssueListing());

      const retrying = controller.retry();

      expect(context.state.loadState).toEqual({ loading: true, error: null });
      await retrying;
      expect(context.state.loadState).toEqual({ loading: false, error: null });
      expect(context.state.listing.issues.length).toBe(1);
    });
  });

  describe('state filter', () => {
    it('pushes the state into the hash, going back to page 1, and reloads', async () => {
      context.hash = `${LIST_HASH}?page=3`;
      const controller = context.buildController();
      await controller.start();

      await controller.changeState('closed');

      expect(context.location.push).toHaveBeenCalledWith(`${LIST_HASH}?state=closed`);
      expect(context.client.list).toHaveBeenCalledWith(...request({ state: 'closed' }));
      expect(context.state.query).toEqual({ state: 'closed', page: 1, search: '' });
    });

    it('goes back to the default for an unknown state', async () => {
      const controller = context.buildController();
      await controller.start();

      await controller.changeState('foo');

      expect(context.state.query.state).toBe('open');
    });
  });

  describe('search', () => {
    it('updates the query and hash at once, going back to page 1', async () => {
      context.hash = `${LIST_HASH}?page=3`;
      const controller = context.buildController();
      await controller.start();

      controller.changeSearch('log');

      expect(context.state.query).toEqual({ state: 'open', page: 1, search: 'log' });
      expect(context.location.replace).toHaveBeenCalledWith(`${LIST_HASH}?search=log`);
    });

    it('reloads once, after the debounce (P2)', async () => {
      const controller = context.buildController();
      await controller.start();
      context.client.list.calls.reset();

      controller.changeSearch('l');
      controller.changeSearch('lo');
      controller.changeSearch('log');
      jasmine.clock().tick(SEARCH_DEBOUNCE_MS - 1);
      expect(context.client.list).not.toHaveBeenCalled();

      jasmine.clock().tick(1);
      await flushMicrotasks();

      expect(context.client.list).toHaveBeenCalledOnceWith(...request({ search: 'log' }));
    });

    it('truncates the typed text to 100 characters', async () => {
      const controller = context.buildController();
      await controller.start();

      controller.changeSearch('x'.repeat(150));

      expect(context.state.query.search).toBe('x'.repeat(100));
    });

    it('ignores an answer that arrives after a newer request (out of order)', async () => {
      const controller = context.buildController();
      await controller.start();
      let answerOld;

      context.client.list.and.returnValues(
        new Promise((resolve) => { answerOld = resolve; }),
        Promise.resolve(buildIssueListing({ issues: [buildIssue({ title: 'new' })] })),
      );

      controller.changeSearch('a');
      jasmine.clock().tick(SEARCH_DEBOUNCE_MS);
      controller.changeSearch('ab');
      jasmine.clock().tick(SEARCH_DEBOUNCE_MS);
      await flushMicrotasks();
      answerOld(buildIssueListing({ issues: [buildIssue({ title: 'old' })] }));
      await flushMicrotasks();

      expect(context.state.listing.issues.map((issue) => issue.title)).toEqual(['new']);
    });

    it('ignores a late failure of an outdated request', async () => {
      const controller = context.buildController();
      await controller.start();
      let failOld;

      context.client.list.and.returnValues(
        new Promise((_, reject) => { failOld = reject; }),
        Promise.resolve(buildIssueListing()),
      );

      controller.changeSearch('a');
      jasmine.clock().tick(SEARCH_DEBOUNCE_MS);
      controller.changeSearch('ab');
      jasmine.clock().tick(SEARCH_DEBOUNCE_MS);
      await flushMicrotasks();
      failOld(new Error('late'));
      await flushMicrotasks();

      expect(context.state.loadState.error).toBeNull();
    });
  });

  describe('#changePage', () => {
    it('pushes the page into the hash and reloads it', async () => {
      const controller = context.buildController();
      await controller.start();

      await controller.changePage(2);

      expect(context.location.push).toHaveBeenCalledWith(`${LIST_HASH}?page=2`);
      expect(context.client.list).toHaveBeenCalledWith(...request({ page: 2 }));
      expect(context.state.query.page).toBe(2);
    });

    it('cancels a pending debounced search reload', async () => {
      const controller = context.buildController();
      await controller.start();
      controller.changeSearch('x');
      context.client.list.calls.reset();

      await controller.changePage(2);
      jasmine.clock().tick(SEARCH_DEBOUNCE_MS);
      await flushMicrotasks();

      expect(context.client.list).toHaveBeenCalledTimes(1);
    });
  });

  describe('bulk selection clearing', () => {
    let clearSelection;
    let controller;

    beforeEach(async () => {
      clearSelection = jasmine.createSpy('clearSelection');
      controller = new IssuesController(
        { ...context.setters, clearSelection }, PROJECT_ID, context.client, context.location,
      );
      await controller.start();
      clearSelection.calls.reset();
    });

    it('clears on a state change', async () => {
      await controller.changeState('closed');

      expect(clearSelection).toHaveBeenCalled();
    });

    it('clears on a page change', async () => {
      await controller.changePage(2);

      expect(clearSelection).toHaveBeenCalled();
    });

    it('clears on a search change', () => {
      controller.changeSearch('x');

      expect(clearSelection).toHaveBeenCalled();
    });

    it('clears when the hash brings a new query (Back and Forward)', async () => {
      context.hash = `${LIST_HASH}?page=2`;

      await controller.handleHashChange();

      expect(clearSelection).toHaveBeenCalled();
    });

    it('does not clear on a plain re-read of the same page', async () => {
      await controller.load();

      expect(clearSelection).not.toHaveBeenCalled();
    });

    it('works without a clearSelection callback', async () => {
      await expectAsync(context.buildController().changePage(2)).toBeResolved();
    });
  });
});
