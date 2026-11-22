import React from 'react';
import RepositoryLabel from '../../../../../../assets/js/components/resources/projects/RepositoryLabel.jsx';
import { buildProjectRepository } from '../../../../../support/issuesBuilders.js';
import { renderedOutput } from '../../../../../support/renderedOutput.js';

describe('RepositoryLabel', () => {
  const outputOf = (repository) => renderedOutput(React.createElement(RepositoryLabel, { repository }));

  it('shows "No repository" for null', () => {
    expect(outputOf(null).contains('No repository')).toBe(true);
  });

  [
    ['added', 'Added', 'text-bg-success'],
    ['not_added', 'Not added', 'text-bg-warning'],
    ['unavailable', 'Unavailable', 'text-bg-danger'],
    ['unknown', 'Unknown', 'text-bg-secondary'],
  ].forEach(([status, label, className]) => {
    it(`shows owner/name and the ${label} badge for ${status}`, () => {
      const output = outputOf(buildProjectRepository({ status }));

      expect(output.contains('darthjee/kerghan')).toBe(true);
      expect(output.containsElement('span', label)).toBe(true);
      expect(output.contains(className)).toBe(true);
    });
  });

  it('falls back to the Unknown badge for an unexpected status', () => {
    expect(outputOf(buildProjectRepository({ status: 'weird' })).containsElement('span', 'Unknown')).toBe(true);
  });

  it('shows "Unknown repository" when the name could not be resolved', () => {
    const output = outputOf(buildProjectRepository({ fullName: null, status: 'unavailable' }));

    expect(output.contains('Unknown repository')).toBe(true);
    expect(output.containsElement('span', 'Unavailable')).toBe(true);
  });

  it('renders the name as text (S1)', () => {
    const output = outputOf(buildProjectRepository({ fullName: '<b>x</b>/y' }));

    expect(output.contains('<b>')).toBe(false);
  });
});
