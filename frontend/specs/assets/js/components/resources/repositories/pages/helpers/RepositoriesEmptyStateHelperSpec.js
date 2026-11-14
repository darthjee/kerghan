import React from 'react';
import RepositoriesEmptyStateHelper from '../../../../../../../../assets/js/components/resources/repositories/pages/helpers/RepositoriesEmptyStateHelper.jsx';
import { renderedOutput } from '../../../../../../../support/renderedOutput.js';
import { buildSyncState } from '../../../../../../../support/repositoriesBuilders.js';

describe('RepositoriesEmptyStateHelper', () => {
  const page = (sync, query) => renderedOutput(
    React.createElement('div', null, RepositoriesEmptyStateHelper.render(sync, query)),
  );
  const noFilter = { filter: 'all', search: '' };

  it('explains both options with links when there is no source', () => {
    const output = page(buildSyncState({ sources: [] }), noFilter);

    expect(output.containsAttribute('href', '#/account/my-account')).toBeTrue();
    expect(output.containsAttribute('href', '#/account/integrations')).toBeTrue();
  });

  it('says no repositories were found when there are sources', () => {
    const output = page(buildSyncState(), noFilter);

    expect(output.contains('No repositories found. Check the sources above.')).toBeTrue();
    expect(output.containsTag('a')).toBeFalse();
  });

  it('says nothing matches a filter', () => {
    expect(page(buildSyncState(), { filter: 'added', search: '' })
      .contains('No repositories match your filters.')).toBeTrue();
  });

  it('says nothing matches a search', () => {
    expect(page(buildSyncState(), { filter: 'all', search: 'zzz' })
      .contains('No repositories match your filters.')).toBeTrue();
  });
});
