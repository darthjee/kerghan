import React from 'react';
import IssuesEmptyStateHelper from '../../../../../../../../assets/js/components/resources/issues/list/helpers/IssuesEmptyStateHelper.jsx';
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
});
