import React from 'react';
import IssueLinkCellHelper from '../../../../../../../../assets/js/components/resources/issues/list/helpers/IssueLinkCellHelper.jsx';
import { buildLink } from '../../../../../../../support/issuesBuilders.js';
import { renderedOutput } from '../../../../../../../support/renderedOutput.js';

describe('IssueLinkCellHelper', () => {
  const render = (link) => renderedOutput(React.createElement(React.Fragment, null, IssueLinkCellHelper.render(link)));

  it('shows a dash for an unlinked issue', () => {
    const rendered = render(null);

    expect(rendered.contains('—')).toBeTrue();
    expect(rendered.containsTag('a')).toBeFalse();
  });

  it('shows only the #N link for a healthy link', () => {
    const rendered = render(buildLink());

    expect(rendered.containsElement('a', '#12')).toBeTrue();
    expect(rendered.containsTag('span')).toBeFalse();
  });

  it('adds the state badge when the state is not linked', () => {
    const rendered = render(buildLink({ state: 'sync_failed', states: ['sync_failed'] }));

    expect(rendered.containsElement('a', '#12')).toBeTrue();
    expect(rendered.containsElement('span', 'Sync failed')).toBeTrue();
  });

  it('adds a muted stale marker', () => {
    const rendered = render(buildLink({ stale: true }));

    expect(rendered.containsElement('span', 'stale')).toBeTrue();
    expect(rendered.containsAttribute('class', 'text-muted ms-2')).toBeTrue();
  });

  it('shows the badge and the stale marker together', () => {
    const rendered = render(buildLink({ state: 'pending', states: ['pending'], stale: true }));

    expect(rendered.containsElement('span', 'Pending')).toBeTrue();
    expect(rendered.containsElement('span', 'stale')).toBeTrue();
  });

  it('shows no link for an unsafe URL but keeps the badge', () => {
    const rendered = render(buildLink({ url: 'javascript:alert(1)', state: 'gone', states: ['gone'] }));

    expect(rendered.containsTag('a')).toBeFalse();
    expect(rendered.containsElement('span', 'GitHub issue gone')).toBeTrue();
  });
});
