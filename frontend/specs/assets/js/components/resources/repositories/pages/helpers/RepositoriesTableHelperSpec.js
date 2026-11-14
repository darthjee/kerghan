import React from 'react';
import RepositoriesTableHelper from '../../../../../../../../assets/js/components/resources/repositories/pages/helpers/RepositoriesTableHelper.jsx';
import { findElements } from '../../../../../../../support/elementTree.js';
import { renderedOutput } from '../../../../../../../support/renderedOutput.js';
import {
  buildRepository, buildSource, buildSyncState,
} from '../../../../../../../support/repositoriesBuilders.js';

const noop = Function.prototype;

describe('RepositoriesTableHelper', () => {
  const handlers = { onAdd: jasmine.createSpy('onAdd').and.returnValue(noop) };
  const stateWith = (repository, overrides = {}) => ({
    listing: { repositories: [repository], pagination: null },
    sync: buildSyncState(),
    addState: new Map(),
    ...overrides,
  });
  const tree = (repository, overrides) => RepositoriesTableHelper.render(
    stateWith(repository, overrides), handlers,
  );
  const page = (repository, overrides) => renderedOutput(tree(repository, overrides));

  it('links owner/name to the GitHub page, in a new tab', () => {
    const output = page(buildRepository());

    expect(output.containsAttribute('href', 'https://github.com/darthjee/kerghan')).toBeTrue();
    expect(output.containsAttribute('target', '_blank')).toBeTrue();
    expect(output.containsAttribute('rel', 'noopener noreferrer')).toBeTrue();
    expect(output.containsElement('a', 'darthjee/kerghan')).toBeTrue();
  });

  it('URL-encodes the owner and name in the link', () => {
    const output = page(buildRepository({ owner: 'a b', name: 'x#y', fullName: 'a b/x#y' }));

    expect(output.containsAttribute('href', 'https://github.com/a%20b/x%23y')).toBeTrue();
  });

  it('shows the visibility badge', () => {
    expect(page(buildRepository({ private: false })).containsElement('span', 'Public')).toBeTrue();
    expect(page(buildRepository({ private: true })).containsElement('span', 'Private')).toBeTrue();
  });

  [
    ['added', 'Added'], ['not_added', 'Not added'], ['unavailable', 'Unavailable'], ['unknown', 'Unknown'],
  ].forEach(([status, label]) => {
    it(`shows the ${label} status`, () => {
      expect(page(buildRepository({ status })).containsElement('td', label)).toBeTrue();
    });
  });

  describe('source badges', () => {
    const handleSource = { kind: 'handle', handle: 'darthjee' };
    const sourced = (sources, syncSources) => page(
      buildRepository({ sources }), { sync: buildSyncState({ sources: syncSources }) },
    );

    it('shows an integration label and a handle', () => {
      const output = sourced([buildSource(), handleSource], [buildSource()]);

      expect(output.containsElement('span', 'work-pat')).toBeTrue();
      expect(output.containsElement('span', 'darthjee')).toBeTrue();
    });

    it('does not mute an ok source', () => {
      const output = sourced([buildSource()], [buildSource()]);

      expect(output.contains('opacity-50')).toBeFalse();
      expect(output.contains('could not be refreshed')).toBeFalse();
    });

    it('does not mute a page_cap_reached source', () => {
      expect(sourced([buildSource()], [buildSource({ status: 'page_cap_reached' })])
        .contains('opacity-50')).toBeFalse();
    });

    ['error', 'invalid_credentials', 'rate_limited', 'not_found'].forEach((status) => {
      it(`mutes a ${status} source with the could-not-be-refreshed label`, () => {
        const output = sourced([buildSource()], [buildSource({ status })]);

        expect(output.contains('opacity-50')).toBeTrue();
        expect(output.containsAttribute('title', 'work-pat could not be refreshed')).toBeTrue();
        expect(output.containsAttribute('aria-label', 'work-pat could not be refreshed')).toBeTrue();
      });
    });

    it('mutes a pending source with the not-synced-yet label', () => {
      const output = sourced([buildSource()], [buildSource({ status: 'pending' })]);

      expect(output.containsAttribute('aria-label', 'work-pat has not been synced yet')).toBeTrue();
    });

    it('treats a source missing from the sync state as healthy', () => {
      expect(sourced([buildSource()], []).contains('opacity-50')).toBeFalse();
    });

    it('matches a handle source by its handle', () => {
      const output = sourced([handleSource], [{ ...handleSource, status: 'error', syncedAt: 'T' }]);

      expect(output.containsAttribute('aria-label', 'darthjee could not be refreshed')).toBeTrue();
    });
  });

  describe('Add', () => {
    it('shows an Add button on a not-added row, sending the githubId', () => {
      const [button] = findElements(tree(buildRepository({ githubId: 7 })), (node) => node.type === 'button');

      expect(button).toBeDefined();
      expect(handlers.onAdd).toHaveBeenCalledWith(7);
    });

    it('shows no Add button on other rows', () => {
      ['added', 'unavailable', 'unknown'].forEach((status) => {
        expect(page(buildRepository({ status })).containsElement('button', 'Add')).toBeFalse();
      });
    });

    it('shows a spinner and disables the button while pending', () => {
      const addState = new Map([[123456, { status: 'pending' }]]);
      const output = page(buildRepository(), { addState });

      expect(output.contains('spinner-border')).toBeTrue();
      expect(output.contains('disabled')).toBeTrue();
    });

    it('shows no spinner when idle', () => {
      expect(page(buildRepository()).contains('spinner-border')).toBeFalse();
    });

    it('shows the inline error', () => {
      const addState = new Map([[123456, { status: 'error', message: 'Repository not found on GitHub.' }]]);
      const output = page(buildRepository(), { addState });

      expect(output.contains('Repository not found on GitHub.')).toBeTrue();
      expect(output.containsAttribute('href', '#/account/integrations')).toBeFalse();
    });

    it('shows the Integrations link for an unusable source', () => {
      const addState = new Map([[123456, {
        status: 'error',
        message: 'Fix the integration that sees this repository in',
        link: { href: '#/account/integrations', text: 'Integrations' },
      }]]);
      const output = page(buildRepository(), { addState });

      expect(output.containsAttribute('href', '#/account/integrations')).toBeTrue();
      expect(output.containsElement('a', 'Integrations')).toBeTrue();
    });
  });

  it('renders every row', () => {
    const rows = [buildRepository({ githubId: 1 }), buildRepository({ githubId: 2, fullName: 'a/b', owner: 'a', name: 'b' })];
    const output = renderedOutput(React.createElement('div', null, RepositoriesTableHelper.render(
      stateWith(rows[0], { listing: { repositories: rows, pagination: null } }), handlers,
    )));

    expect(output.containsElement('a', 'a/b')).toBeTrue();
    expect(output.containsElement('a', 'darthjee/kerghan')).toBeTrue();
  });
});
