import React from 'react';
import RepositoryHint from '../../../../../../assets/js/components/resources/projects/RepositoryHint.jsx';
import { buildProjectRepository } from '../../../../../support/issuesBuilders.js';
import { renderedOutput } from '../../../../../support/renderedOutput.js';

describe('RepositoryHint', () => {
  const outputOf = (repository) => renderedOutput(React.createElement(RepositoryHint, { repository }));

  it('renders nothing for an added repository', () => {
    expect(outputOf(buildProjectRepository({ status: 'added' })).isEmpty()).toBe(true);
  });

  it('renders nothing for a project without a repository', () => {
    expect(outputOf(null).isEmpty()).toBe(true);
  });

  it('renders nothing for any other status', () => {
    expect(outputOf(buildProjectRepository({ status: 'not_added' })).isEmpty()).toBe(true);
  });

  it('says sync and linking are paused for Unavailable, linking to the repositories page', () => {
    const output = outputOf(buildProjectRepository({ status: 'unavailable' }));

    expect(output.contains('Unavailable: sync and linking are paused')).toBe(true);
    expect(output.containsAttribute('href', '#/repositories')).toBe(true);
  });

  it('says the repository was not seen in the last sync for Unknown, with no link', () => {
    const output = outputOf(buildProjectRepository({ status: 'unknown' }));

    expect(output.contains('Unknown: not seen in the last repository sync')).toBe(true);
    expect(output.containsTag('a')).toBe(false);
  });
});
