import ApiError from '../../../../../../../../assets/js/client/ApiError.js';
import { SEARCH_DEBOUNCE_MS } from '../../../../../../../../assets/js/components/resources/repositories/pages/controllers/RepositoriesController.js';
import { useRepositoriesControllerHarness } from '../../../../../../../support/repositoriesControllerHarness.js';
import {
  buildListing, buildRepository, buildSource, buildSyncState,
} from '../../../../../../../support/repositoriesBuilders.js';

describe('RepositoriesController', () => {
  const context = useRepositoriesControllerHarness();

  describe('.load', () => {
    it('lists with the initial query', async () => {
      context.client.list.and.resolveTo(buildListing());

      await context.buildController().load();

      expect(context.client.list).toHaveBeenCalledWith({ page: 1, filter: 'all', search: '' });
    });

    it('stores the rows, pagination and sync state', async () => {
      const listing = buildListing();
      context.client.list.and.resolveTo(listing);

      await context.buildController().load();

      expect(context.state.listing).toEqual({
        repositories: listing.repositories, pagination: listing.pagination,
      });
      expect(context.state.sync).toEqual(listing.sync);
      expect(context.state.loadState).toEqual({ loading: false, error: null });
    });

    it('does not touch state when the session expired', async () => {
      context.client.list.and.resolveTo(undefined);

      await context.buildController().load();

      expect(context.setters.setListing).not.toHaveBeenCalled();
    });

    it('stores the error message on failure', async () => {
      context.client.list.and.rejectWith(new ApiError(500, 'Boom'));

      await context.buildController().load();

      expect(context.state.loadState).toEqual({ loading: false, error: 'Boom' });
    });

    it('falls back to a generic load error', async () => {
      context.client.list.and.rejectWith({});

      await context.buildController().load();

      expect(context.state.loadState.error).toBe('Could not load your repositories.');
    });

    it('shows the loading state again on retry', async () => {
      context.client.list.and.resolveTo(buildListing());

      await context.buildController().retry();

      expect(context.setters.setLoadState.calls.argsFor(0)[0]).toEqual({ loading: true, error: null });
      expect(context.state.loadState.loading).toBeFalse();
    });

    it('stores the cooldown end of the sync state', async () => {
      const sync = buildSyncState({ refreshAvailableAt: '2026-11-07T12:05:00Z' });
      context.client.list.and.resolveTo(buildListing({ sync }));

      await context.buildController().load();

      expect(context.state.cooldownUntil).toBe(Date.parse('2026-11-07T12:05:00Z'));
    });
  });

  describe('query changes', () => {
    beforeEach(() => {
      context.client.list.and.resolveTo(buildListing());
    });

    it('reloads on a filter change, back to page 1', async () => {
      const controller = context.buildController();
      await controller.changePage(3);

      await controller.changeFilter('added');

      expect(context.client.list.calls.mostRecent().args[0])
        .toEqual({ page: 1, filter: 'added', search: '' });
      expect(context.state.query).toEqual({ page: 1, filter: 'added', search: '' });
    });

    it('reloads on a page change', async () => {
      await context.buildController().changePage(2);

      expect(context.client.list).toHaveBeenCalledWith({ page: 2, filter: 'all', search: '' });
    });

    it('debounces the search reload', () => {
      const controller = context.buildController();

      controller.changeSearch('k');
      controller.changeSearch('ker');
      jasmine.clock().tick(SEARCH_DEBOUNCE_MS - 1);

      expect(context.client.list).not.toHaveBeenCalled();

      jasmine.clock().tick(1);

      expect(context.client.list).toHaveBeenCalledTimes(1);
      expect(context.client.list).toHaveBeenCalledWith({ page: 1, filter: 'all', search: 'ker' });
    });

    it('stores the search right away', () => {
      context.buildController().changeSearch('ker');

      expect(context.state.query.search).toBe('ker');
    });
  });

  describe('empty-page jump', () => {
    const empty = (totalPages, total = 120) => buildListing({
      repositories: [], pagination: { page: 3, perPage: 50, total, totalPages },
    });

    it('jumps to the last page and reloads once', async () => {
      context.client.list.and.returnValues(Promise.resolve(empty(2)), Promise.resolve(buildListing()));
      const controller = context.buildController();
      await controller.changePage(3);

      expect(context.client.list).toHaveBeenCalledTimes(2);
      expect(context.client.list.calls.mostRecent().args[0].page).toBe(2);
      expect(context.state.query.page).toBe(2);
    });

    it('does not loop when the last page is empty too', async () => {
      context.client.list.and.resolveTo(empty(2));

      await context.buildController().changePage(3);

      expect(context.client.list).toHaveBeenCalledTimes(2);
    });

    it('does not jump on page 1', async () => {
      context.client.list.and.resolveTo(empty(1, 0));

      await context.buildController().load();

      expect(context.client.list).toHaveBeenCalledTimes(1);
    });

    it('does not jump when nothing matches', async () => {
      context.client.list.and.resolveTo(empty(0, 0));

      await context.buildController().changePage(3);

      expect(context.client.list).toHaveBeenCalledTimes(1);
    });
  });

  describe('.dismiss', () => {
    it('stores the source key, status and syncedAt', () => {
      context.buildController().dismiss(buildSource({ status: 'error' }));

      expect(context.state.dismissed).toEqual(new Set(['integration:uuid-1|error|2026-11-07T11:00:00Z']));
    });

    it('keeps earlier dismissals', () => {
      const controller = context.buildController();

      controller.dismiss(buildSource({ status: 'error' }));
      controller.dismiss(buildSource({ status: 'error', syncedAt: 'later' }));

      expect(context.state.dismissed.size).toBe(2);
    });
  });

  describe('.dispose', () => {
    it('clears the Add state', () => {
      const controller = context.buildController();
      controller.addStore.pending(7);

      controller.dispose();

      expect(context.state.addState.size).toBe(0);
    });

    it('ignores a listing that lands after disposal', async () => {
      context.client.list.and.resolveTo(buildListing({ repositories: [buildRepository()] }));
      const controller = context.buildController();
      const loading = controller.load();

      controller.dispose();
      await loading;

      expect(context.setters.setListing).not.toHaveBeenCalled();
    });
  });
});
