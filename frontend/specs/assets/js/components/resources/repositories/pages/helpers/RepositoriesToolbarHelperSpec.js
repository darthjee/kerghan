import RepositoriesToolbarHelper from '../../../../../../../../assets/js/components/resources/repositories/pages/helpers/RepositoriesToolbarHelper.jsx';
import { findButton, findElements } from '../../../../../../../support/elementTree.js';
import { renderedOutput } from '../../../../../../../support/renderedOutput.js';
import { buildSyncState } from '../../../../../../../support/repositoriesBuilders.js';

const noop = Function.prototype;

describe('RepositoriesToolbarHelper', () => {
  const NOW = Date.parse('2026-11-07T12:00:00Z');
  const handlers = {
    onFilterChange: noop, onSearchChange: noop, onRefresh: noop,
  };
  const stateWith = (overrides = {}) => ({
    sync: buildSyncState(),
    query: { page: 1, filter: 'all', search: '' },
    now: NOW,
    cooldownUntil: null,
    refreshNotice: null,
    ...overrides,
  });
  const tree = (overrides) => RepositoriesToolbarHelper.render(stateWith(overrides), handlers);
  const page = (overrides) => renderedOutput(tree(overrides));

  it('offers All, Added, Not added and Unavailable, but not Unknown', () => {
    const output = page();

    ['All', 'Added', 'Not added', 'Unavailable'].forEach((text) => {
      expect(output.containsElement('option', text)).toBeTrue();
    });
    expect(output.contains('Unknown')).toBeFalse();
  });

  it('selects the query filter and shows the search text', () => {
    const output = page({ query: { page: 1, filter: 'added', search: 'ker' } });

    expect(output.containsAttribute('value', 'ker')).toBeTrue();
    expect(output.contains('<option value="added" selected="">Added')).toBeTrue();
  });

  it('wires the filter, search and refresh handlers', () => {
    const [select] = findElements(tree(), (node) => node.type === 'select');
    const [input] = findElements(tree(), (node) => node.type === 'input');

    expect(select.props.onChange).toBe(handlers.onFilterChange);
    expect(input.props.onChange).toBe(handlers.onSearchChange);
    expect(findButton(tree(), 'Refresh').props.onClick).toBe(handlers.onRefresh);
  });

  it('enables Refresh outside any cooldown', () => {
    expect(findButton(tree(), 'Refresh').props.disabled).toBeFalse();
  });

  it('disables Refresh and reads Syncing… while syncing', () => {
    const button = findButton(tree({ sync: buildSyncState({ state: 'syncing' }) }), 'Syncing…');

    expect(button.props.disabled).toBeTrue();
  });

  it('disables Refresh inside the cooldown with the countdown as tooltip and label', () => {
    const output = page({ cooldownUntil: NOW + 154000 });
    const button = findButton(tree({ cooldownUntil: NOW + 154000 }), 'Refresh');

    expect(button.props.disabled).toBeTrue();
    expect(output.containsAttribute('title', 'Refresh available in 2m 34s')).toBeTrue();
    expect(output.containsAttribute('aria-label', 'Refresh available in 2m 34s')).toBeTrue();
  });

  it('re-enables Refresh once the cooldown is over', () => {
    expect(findButton(tree({ cooldownUntil: NOW - 1 }), 'Refresh').props.disabled).toBeFalse();
  });

  it('shows the last synced label', () => {
    expect(page({ sync: buildSyncState({ lastSyncedAt: '2026-11-07T11:55:00Z' }) })
      .contains('Last synced 5 min ago')).toBeTrue();
  });

  it('shows no last synced label before the first sync', () => {
    expect(page({ sync: buildSyncState({ lastSyncedAt: null }) }).contains('Last synced')).toBeFalse();
  });

  it('shows the Refresh notice', () => {
    expect(page({ refreshNotice: 'Try again in 30 s.' }).contains('Try again in 30 s.')).toBeTrue();
  });
});
