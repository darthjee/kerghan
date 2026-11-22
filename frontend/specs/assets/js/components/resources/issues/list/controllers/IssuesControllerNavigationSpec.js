import { SEARCH_DEBOUNCE_MS } from '../../../../../../../../assets/js/components/resources/issues/list/controllers/IssuesController.js';
import { flushMicrotasks } from '../../../../../../../support/flushMicrotasks.js';
import {
  buildIssueListing, buildPagination, PROJECT_ID,
} from '../../../../../../../support/issuesBuilders.js';
import { LIST_HASH, useIssuesControllerHarness } from '../../../../../../../support/issuesControllerHarness.js';

describe('IssuesController navigation', () => {
  const context = useIssuesControllerHarness();
  const request = (overrides) => [PROJECT_ID, { state: 'open', search: '', page: 1, perPage: 50, ...overrides }];

  beforeEach(() => {
    context.client.list.and.resolveTo(buildIssueListing());
  });

  describe('#handleHashChange', () => {
    it('adopts a changed query (Back) and reloads', async () => {
      const controller = context.buildController();
      await controller.start();
      context.client.list.calls.reset();
      context.hash = `${LIST_HASH}?state=closed&page=2`;

      await controller.handleHashChange();

      expect(context.client.list).toHaveBeenCalledOnceWith(...request({ state: 'closed', page: 2 }));
      expect(context.state.query).toEqual({ state: 'closed', page: 2, search: '' });
    });

    it('does nothing when the query is the one shown', async () => {
      const controller = context.buildController();
      await controller.start();
      context.client.list.calls.reset();

      await controller.handleHashChange();

      expect(context.client.list).not.toHaveBeenCalled();
    });

    it('does nothing once the hash left the list', async () => {
      const controller = context.buildController();
      await controller.start();
      context.client.list.calls.reset();
      context.hash = `${LIST_HASH}/issues/abc`;

      await controller.handleHashChange();

      expect(context.client.list).not.toHaveBeenCalled();
    });
  });

  describe('U5: a page past the end, or left empty', () => {
    const emptyPage = (page, totalPages, total) => ({
      issues: [], pagination: buildPagination({ page, totalPages, total }),
    });

    it('jumps to the last non-empty page', async () => {
      context.hash = `${LIST_HASH}?page=9`;
      context.client.list.and.returnValues(
        Promise.resolve(emptyPage(9, 3, 120)),
        Promise.resolve(buildIssueListing({ pagination: buildPagination({ page: 3, totalPages: 3, total: 120 }) })),
      );

      await context.buildController().start();

      expect(context.client.list.calls.allArgs()).toEqual([request({ page: 9 }), request({ page: 3 })]);
      expect(context.state.query.page).toBe(3);
      expect(context.location.replace).toHaveBeenCalledWith(`${LIST_HASH}?page=3`);
      expect(context.state.listing.issues.length).toBe(1);
    });

    it('jumps to page 1 when there are no rows at all', async () => {
      context.hash = `${LIST_HASH}?page=2`;
      context.client.list.and.returnValues(
        Promise.resolve(emptyPage(2, 0, 0)),
        Promise.resolve(buildIssueListing({ issues: [], pagination: buildPagination({ total: 0, totalPages: 0 }) })),
      );

      await context.buildController().start();

      expect(context.state.query.page).toBe(1);
      expect(context.client.list).toHaveBeenCalledTimes(2);
      expect(context.state.loadState.loading).toBe(false);
    });

    it('jumps only once, never looping', async () => {
      context.hash = `${LIST_HASH}?page=2`;
      context.client.list.and.resolveTo(emptyPage(2, 5, 5));

      await context.buildController().start();

      expect(context.client.list.calls.count()).toBeLessThanOrEqual(2);
    });

    it('does not jump from an empty first page', async () => {
      context.client.list.and.resolveTo(emptyPage(1, 0, 0));

      await context.buildController().start();

      expect(context.client.list).toHaveBeenCalledTimes(1);
      expect(context.state.listing.issues).toEqual([]);
    });
  });

  describe('#dispose', () => {
    it('cancels the pending search reload', async () => {
      const controller = context.buildController();
      await controller.start();
      context.client.list.calls.reset();
      controller.changeSearch('x');

      controller.dispose();
      jasmine.clock().tick(SEARCH_DEBOUNCE_MS);
      await flushMicrotasks();

      expect(context.client.list).not.toHaveBeenCalled();
    });

    it('ignores an answer arriving after unmount', async () => {
      let answer;

      context.client.list.and.returnValue(new Promise((resolve) => { answer = resolve; }));
      const controller = context.buildController();
      const started = controller.start();

      controller.dispose();
      answer(buildIssueListing());
      await started;

      expect(context.setters.setListing).not.toHaveBeenCalled();
    });
  });
});
