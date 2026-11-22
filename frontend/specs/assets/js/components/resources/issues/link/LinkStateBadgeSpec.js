import React from 'react';
import LinkStateBadge from '../../../../../../../assets/js/components/resources/issues/link/LinkStateBadge.jsx';
import { renderedOutput } from '../../../../../../support/renderedOutput.js';

describe('LinkStateBadge', () => {
  const render = (state) => renderedOutput(React.createElement(LinkStateBadge, { state }));

  [
    ['linked', 'Synced', 'success'],
    ['pending', 'Pending', 'info'],
    ['rate_limited', 'Rate limited', 'warning'],
    ['repository_unavailable', 'Repository unavailable', 'secondary'],
    ['sync_failed', 'Sync failed', 'danger'],
    ['gone', 'GitHub issue gone', 'dark'],
  ].forEach(([state, label, variant]) => {
    it(`shows ${state} as ${label} (${variant})`, () => {
      const rendered = render(state);

      expect(rendered.containsElement('span', label)).toBeTrue();
      expect(rendered.containsAttribute('class', `badge text-bg-${variant}`)).toBeTrue();
    });
  });

  it('renders nothing for an unknown state', () => {
    expect(render('mystery').isEmpty()).toBeTrue();
    expect(render(undefined).isEmpty()).toBeTrue();
  });
});
