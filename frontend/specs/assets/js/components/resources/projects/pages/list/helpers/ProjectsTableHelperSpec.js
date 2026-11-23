import React from 'react';
import ProjectsTableHelper from '../../../../../../../../../assets/js/components/resources/projects/pages/list/helpers/ProjectsTableHelper.jsx';
import { findElements } from '../../../../../../../../support/elementTree.js';
import { buildProject, buildProjectRepository, PROJECT_ID } from '../../../../../../../../support/issuesBuilders.js';
import { renderedOutput } from '../../../../../../../../support/renderedOutput.js';

describe('ProjectsTableHelper', () => {
  const outputOf = (projects) => renderedOutput(React.createElement('div', null, ProjectsTableHelper.render(projects)));

  it('renders the Name, Repository and Open issues columns, and no description', () => {
    const output = outputOf([buildProject({ description: 'Secret description', openIssueCount: 7 })]);

    expect(output.containsElement('th', 'Name')).toBe(true);
    expect(output.containsElement('th', 'Repository')).toBe(true);
    expect(output.contains('Secret description')).toBe(false);
    expect(output.containsElement('th', 'Open issues')).toBe(true);
    expect(output.containsElement('td', '7 open')).toBe(true);
  });

  it('shows 0 open for a project without open issues', () => {
    expect(outputOf([buildProject({ openIssueCount: 0 })]).containsElement('td', '0 open')).toBe(true);
  });

  it('reads a missing count as 0 open', () => {
    expect(outputOf([buildProject({ openIssueCount: undefined })]).containsElement('td', '0 open')).toBe(true);
  });

  it('renders the count as muted text', () => {
    const [cell] = findElements(
      ProjectsTableHelper.render([buildProject({ openIssueCount: 3 })]),
      (node) => node.type === 'td' && node.props.children === '3 open',
    );

    expect(cell.props.className).toBe('text-muted');
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
      (node) => node.type === 'tr' && node.props.children.length === 3 && node.key !== null,
    );

    expect(rows.length).toBe(2);
  });

  it('shows the Unavailable badge', () => {
    const output = outputOf([buildProject({ repository: buildProjectRepository({ status: 'unavailable' }) })]);

    expect(output.containsElement('span', 'Unavailable')).toBe(true);
  });
});
