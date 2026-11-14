import {
  buildListing, buildRepository, buildSource, buildSyncState,
} from './repositoriesBuilders.js';

describe('repositoriesBuilders support', () => {
  describe('buildRepository', () => {
    it('defaults to a public, not-added darthjee/kerghan row', () => {
      expect(buildRepository()).toEqual(jasmine.objectContaining({
        fullName: 'darthjee/kerghan', private: false, status: 'not_added', addedAt: null,
      }));
    });

    it('applies overrides', () => {
      expect(buildRepository({ status: 'added' }).status).toBe('added');
    });
  });

  describe('buildSource', () => {
    it('defaults to an ok integration source work-pat', () => {
      expect(buildSource()).toEqual(jasmine.objectContaining({
        kind: 'integration', status: 'ok', integration: { uuid: 'uuid-1', label: 'work-pat' },
      }));
    });

    it('applies overrides', () => {
      expect(buildSource({ status: 'error' }).status).toBe('error');
    });
  });

  describe('buildSyncState', () => {
    it('defaults to an idle state with Refresh available', () => {
      expect(buildSyncState()).toEqual(jasmine.objectContaining({
        state: 'idle', refreshAvailableAt: null, lastSyncedAt: '2026-11-07T11:00:00Z',
      }));
    });

    it('applies overrides', () => {
      expect(buildSyncState({ state: 'syncing' }).state).toBe('syncing');
    });
  });

  describe('buildListing', () => {
    it('defaults to one repository, one page and an idle sync', () => {
      const listing = buildListing();

      expect(listing.repositories.length).toBe(1);
      expect(listing.pagination).toEqual({ page: 1, perPage: 50, total: 1, totalPages: 1 });
      expect(listing.sync.state).toBe('idle');
    });

    it('applies the given parts', () => {
      const sync = buildSyncState({ state: 'syncing' });
      const listing = buildListing({ repositories: [], pagination: { page: 2 }, sync });

      expect(listing).toEqual({ repositories: [], pagination: { page: 2 }, sync });
    });
  });
});
