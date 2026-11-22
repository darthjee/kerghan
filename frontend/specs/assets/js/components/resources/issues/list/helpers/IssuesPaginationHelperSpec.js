import React from 'react';
import IssuesPaginationHelper from '../../../../../../../../assets/js/components/resources/issues/list/helpers/IssuesPaginationHelper.jsx';
import { renderedOutput } from '../../../../../../../support/renderedOutput.js';

describe('IssuesPaginationHelper', () => {
  const handlers = { onPageChange: () => () => undefined };

  it('renders nothing for a single page', () => {
    expect(IssuesPaginationHelper.render({ page: 1, totalPages: 1 }, handlers)).toBeNull();
  });

  it('renders the page controls for several pages', () => {
    const output = renderedOutput(React.createElement('div', null,
      IssuesPaginationHelper.render({ page: 2, totalPages: 3 }, handlers)));

    expect(output.containsTag('ul')).toBe(true);
    expect(output.contains('3')).toBe(true);
  });
});
