import React from 'react';
import ProjectsEmptyStateHelper from '../../../../../../../../../assets/js/components/resources/projects/pages/list/helpers/ProjectsEmptyStateHelper.jsx';
import { renderedOutput } from '../../../../../../../../support/renderedOutput.js';

describe('ProjectsEmptyStateHelper', () => {
  const outputOf = (search) => renderedOutput(
    React.createElement('div', null, ProjectsEmptyStateHelper.render({ page: 1, search })),
  );

  describe('with no search', () => {
    it('says there are no projects, hints at Repositories and offers New project', () => {
      const output = outputOf('');

      expect(output.contains('You have no projects yet.')).toBe(true);
      expect(output.contains('You can also create one from an added repository on')).toBe(true);
      expect(output.containsAttribute('href', '#/repositories')).toBe(true);
      expect(output.containsAttribute('href', '#/projects/new')).toBe(true);
      expect(output.containsElement('a', 'New project')).toBe(true);
    });
  });

  describe('with a search', () => {
    it('says no project matches, echoing the search', () => {
      expect(outputOf('ker').contains('No projects match &quot;ker&quot;.')).toBe(true);
    });

    it('does not offer New project or the hint', () => {
      const output = outputOf('ker');

      expect(output.contains('You have no projects yet.')).toBe(false);
      expect(output.containsTag('a')).toBe(false);
    });

    it('echoes the search as text, never as markup (S1)', () => {
      const output = outputOf('<script>alert(1)</script>');

      expect(output.contains('<script>')).toBe(false);
      expect(output.contains('&lt;script&gt;')).toBe(true);
    });
  });
});
