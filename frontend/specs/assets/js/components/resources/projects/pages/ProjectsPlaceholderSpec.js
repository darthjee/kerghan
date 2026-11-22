import React from 'react';
import ProjectsPlaceholder from '../../../../../../../assets/js/components/resources/projects/pages/ProjectsPlaceholder.jsx';
import { installFakeWindow, uninstallFakeWindow } from '../../../../../../support/fakeWindow.js';
import { renderedOutput } from '../../../../../../support/renderedOutput.js';
import { PROJECT_ID } from '../../../../../../support/issuesBuilders.js';

describe('ProjectsPlaceholder', () => {
  afterEach(() => {
    uninstallFakeWindow();
  });

  const renderAt = (hash) => {
    installFakeWindow({ location: { hash } });
    return renderedOutput(React.createElement(ProjectsPlaceholder));
  };

  it('says the screens are coming soon', () => {
    expect(renderAt(`#/projects/${PROJECT_ID}/issues/new`).contains('Coming soon')).toBe(true);
  });

  ['issues/new', 'issues/2', 'issues/2/edit'].forEach((tail) => {
    it(`links back to the project from …/${tail}`, () => {
      const output = renderAt(`#/projects/${PROJECT_ID}/${tail}?state=closed`);

      expect(output.containsAttribute('href', `#/projects/${PROJECT_ID}`)).toBe(true);
    });
  });

  it('links to the project list when the id is not a uuid (S3)', () => {
    const output = renderAt('#/projects/..%2Fadmin/issues/new');

    expect(output.containsAttribute('href', '#/projects')).toBe(true);
    expect(output.contains('admin')).toBe(false);
  });
});
