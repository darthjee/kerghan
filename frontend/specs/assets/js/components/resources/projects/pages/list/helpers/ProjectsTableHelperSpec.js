import React from 'react';
import ProjectsTableHelper from '../../../../../../../../../assets/js/components/resources/projects/pages/list/helpers/ProjectsTableHelper.jsx';
import { findElements } from '../../../../../../../../support/elementTree.js';
import { buildProject, buildProjectRepository, PROJECT_ID } from '../../../../../../../../support/issuesBuilders.js';
import { renderedOutput } from '../../../../../../../../support/renderedOutput.js';

describe('ProjectsTableHelper', () => {
  const outputOf = (projects) => renderedOutput(React.createElement('div', null, ProjectsTableHelper.render(projects)));

  it('renders the Name and Repository columns, and no description or open-issue count', () => {
    const output = outputOf([buildProject({ description: 'Secret description', openIssueCount: 7 })]);

    expect(output.containsElement('th', 'Name')).toBe(true);
    expect(output.containsElement('th', 'Repository')).toBe(true);
    expect(output.contains('Secret description')).toBe(false);
    expect(output.contains('7 open')).toBe(false);
    expect(output.contains('>7<')).toBe(false);
  });

  it('links the name to the project page, with the full name in title (U8)', () => {
    const [anchor] = findElements(
      ProjectsTableHelper.render([buildProject({ name: 'A very long name' })]),
      (node) => node.type === 'a',
    );

    expect(anchor.props.href).toBe(`#/projects/${PROJECT_ID}`);
    expect(anchor.props.title).toBe('A very long name');
    expect(anchor.props.className).toContain('text-truncate');
    expect(anchor.props.style.overflowWrap).toBe('anywhere');
  });

  it('encodes the id in the link', () => {
    const [anchor] = findElements(
      ProjectsTableHelper.render([buildProject({ id: 'a/b' })]), (node) => node.type === 'a',
    );

    expect(anchor.props.href).toBe('#/projects/a%2Fb');
  });

  it('renders a name as text, never as markup (S1)', () => {
    const output = outputOf([buildProject({ name: '<img src=x onerror=alert(1)>' })]);

    expect(output.contains('<img')).toBe(false);
    expect(output.contains('&lt;img src=x onerror=alert(1)&gt;')).toBe(true);
  });

  it('renders the repository with its status badge', () => {
    const output = outputOf([buildProject()]);

    expect(output.contains('darthjee/kerghan')).toBe(true);
    expect(output.containsElement('span', 'Added')).toBe(true);
  });

  it('renders "No repository" for a project without one', () => {
    expect(outputOf([buildProject({ repository: null })]).contains('No repository')).toBe(true);
  });

  it('renders one row per project', () => {
    const rows = findElements(
      ProjectsTableHelper.render([buildProject(), buildProject({ id: 'other' })]),
      (node) => node.type === 'tr' && node.props.children.length === 2 && node.key !== null,
    );

    expect(rows.length).toBe(2);
  });

  it('shows the Unavailable badge', () => {
    const output = outputOf([buildProject({ repository: buildProjectRepository({ status: 'unavailable' }) })]);

    expect(output.containsElement('span', 'Unavailable')).toBe(true);
  });
});
