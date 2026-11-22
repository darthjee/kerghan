import React from 'react';
import IssuesEmptyStateHelper from '../../../../../../../../assets/js/components/resources/issues/list/helpers/IssuesEmptyStateHelper.jsx';
import { findButton } from '../../../../../../../support/elementTree.js';
import { PROJECT_ID } from '../../../../../../../support/issuesBuilders.js';
import { renderedOutput } from '../../../../../../../support/renderedOutput.js';

describe('IssuesEmptyStateHelper', () => {
  const outputOf = (state, search = '') => renderedOutput(
    React.createElement('div', null, IssuesEmptyStateHelper.render(PROJECT_ID, { state, search, page: 1 })),
  );

  it('says there are no open issues and offers New issue', () => {
    const output = outputOf('open');

    expect(output.contains('No open issues.')).toBe(true);
    expect(output.containsAttribute('href', `#/projects/${PROJECT_ID}/issues/new`)).toBe(true);
    expect(output.containsElement('a', 'New issue')).toBe(true);
  });

  it('says the project has no issues yet for the All filter and offers New issue', () => {
    const output = outputOf('all');

    expect(output.contains('This project has no issues yet.')).toBe(true);
    expect(output.containsElement('a', 'New issue')).toBe(true);
  });

  it('says there are no closed issues, with no action', () => {
    const output = outputOf('closed');

    expect(output.contains('No closed issues.')).toBe(true);
    expect(output.containsTag('a')).toBe(false);
  });

  it('says no issue matches a search, echoing it, with no action', () => {
    const output = outputOf('open', 'log');

    expect(output.contains('No issues match &quot;log&quot;.')).toBe(true);
    expect(output.containsTag('a')).toBe(false);
  });

  it('echoes the search as text, never as markup (S1)', () => {
    const output = outputOf('all', '<script>alert(1)</script>');

    expect(output.contains('<script>')).toBe(false);
    expect(output.contains('&lt;script&gt;')).toBe(true);
  });

  describe('Import from GitHub', () => {
    const treeOf = (state, importEntry) => IssuesEmptyStateHelper.render(PROJECT_ID, { state, search: '', page: 1 }, importEntry);

    ['open', 'all'].forEach((state) => {
      it(`is offered on the ${state} row of a project with a repository, opening the import modal`, () => {
        const onImport = jasmine.createSpy('onImport');
        const button = findButton(React.createElement('div', null, treeOf(state, { canImport: true, onImport })), 'Import from GitHub');

        button.props.onClick();

        expect(onImport).toHaveBeenCalledTimes(1);
      });

      it(`is not offered on the ${state} row of a project without a repository`, () => {
        expect(findButton(React.createElement('div', null, treeOf(state, { canImport: false })), 'Import from GitHub')).toBeUndefined();
        expect(findButton(React.createElement('div', null, treeOf(state)), 'Import from GitHub')).toBeUndefined();
      });
    });

    it('is not offered on the closed row', () => {
      expect(renderedOutput(React.createElement('div', null, treeOf('closed', { canImport: true }))).contains('Import from GitHub')).toBe(false);
    });
  });
});
