import React from 'react';
import RepositoriesHelper from '../../../../../../../../assets/js/components/resources/repositories/pages/helpers/RepositoriesHelper.jsx';
import { renderedOutput } from '../../../../../../../support/renderedOutput.js';
import {
  buildListing, buildRepository, buildSource, buildSyncState,
} from '../../../../../../../support/repositoriesBuilders.js';

const noop = Function.prototype;

describe('RepositoriesHelper', () => {
  const handlers = {
    onFilterChange: noop,
    onSearchChange: noop,
    onRefresh: noop,
    onRetry: noop,
    onAdd: () => noop,
    onDismiss: () => noop,
    onPageChange: () => noop,
  };
  const stateWith = (overrides = {}) => {
    const listing = buildListing();

    return {
      listing: { repositories: listing.repositories, pagination: listing.pagination },
      sync: listing.sync,
      query: { page: 1, filter: 'all', search: '' },
      loadState: { loading: false, error: null },
      addState: new Map(),
      dismissed: new Set(),
      refreshNotice: null,
      now: Date.parse('2026-11-07T12:00:00Z'),
      cooldownUntil: null,
      ...overrides,
    };
  };
  const page = (overrides) => renderedOutput(RepositoriesHelper.render(stateWith(overrides), handlers));

  it('renders the title', () => {
    expect(page().containsElement('h1', 'Repositories')).toBeTrue();
  });

  it('renders the loading message while loading', () => {
    const output = page({ loadState: { loading: true, error: null }, sync: null });

    expect(output.contains('Loading repositories…')).toBeTrue();
    expect(output.containsTag('table')).toBeFalse();
  });

  it('renders the load error with a retry button', () => {
    const output = page({ loadState: { loading: false, error: 'Boom' }, sync: null });

    expect(output.contains('Boom')).toBeTrue();
    expect(output.containsElement('button', 'Retry')).toBeTrue();
  });

  it('renders banners, toolbar, rows and pagination in order', () => {
    const sources = [buildSource({ status: 'error' })];
    const output = page({
      sync: buildSyncState({ sources }),
      listing: {
        repositories: [buildRepository()],
        pagination: { page: 1, perPage: 1, total: 2, totalPages: 2 },
      },
    });

    expect(output.containsInOrder('alert', 'Refresh', '<table', 'pagination')).toBeTrue();
  });

  it('shows the stored rows with the indicator while syncing', () => {
    const output = page({ sync: buildSyncState({ state: 'syncing' }) });

    expect(output.contains('Syncing with GitHub…')).toBeTrue();
    expect(output.contains('spinner-border')).toBeFalse();
    expect(output.containsTag('table')).toBeTrue();
  });

  it('shows the full spinner, and no rows, only on the very first sync', () => {
    const output = page({ sync: buildSyncState({ state: 'syncing', lastSyncedAt: null }) });

    expect(output.contains('spinner-border')).toBeTrue();
    expect(output.containsTag('table')).toBeFalse();
  });

  it('shows no indicator while idle', () => {
    expect(page().contains('Syncing with GitHub')).toBeFalse();
  });

  it('shows the empty state when there are no rows', () => {
    const output = page({
      listing: { repositories: [], pagination: { page: 1, perPage: 50, total: 0, totalPages: 0 } },
    });

    expect(output.contains('No repositories found. Check the sources above.')).toBeTrue();
    expect(output.containsTag('table')).toBeFalse();
  });

  it('shows no empty state while a sync runs with no rows', () => {
    const output = page({
      sync: buildSyncState({ state: 'syncing' }),
      listing: { repositories: [], pagination: { page: 1, perPage: 50, total: 0, totalPages: 0 } },
    });

    expect(output.contains('No repositories')).toBeFalse();
  });

  it('is renderable as an element tree', () => {
    expect(React.isValidElement(RepositoriesHelper.render(stateWith(), handlers))).toBeTrue();
  });
});
