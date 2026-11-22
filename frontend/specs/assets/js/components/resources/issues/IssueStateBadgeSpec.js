import React from 'react';
import IssueStateBadge from '../../../../../../assets/js/components/resources/issues/IssueStateBadge.jsx';
import { renderedOutput } from '../../../../../support/renderedOutput.js';

describe('IssueStateBadge', () => {
  const render = (state) => renderedOutput(React.createElement(IssueStateBadge, { state }));

  it('shows an open issue as Open (success)', () => {
    expect(render('open').containsElement('span', 'Open')).toBe(true);
    expect(render('open').containsAttribute('class', 'badge text-bg-success')).toBe(true);
  });

  it('shows a closed issue as Closed (secondary)', () => {
    expect(render('closed').containsElement('span', 'Closed')).toBe(true);
    expect(render('closed').containsAttribute('class', 'badge text-bg-secondary')).toBe(true);
  });
});
