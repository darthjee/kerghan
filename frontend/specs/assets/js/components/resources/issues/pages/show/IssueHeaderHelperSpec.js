import React from 'react';
import IssueHeaderHelper from '../../../../../../../../assets/js/components/resources/issues/pages/show/IssueHeaderHelper.jsx';
import { findElements } from '../../../../../../../support/elementTree.js';
import { buildIssue, buildProject, PROJECT_ID } from '../../../../../../../support/issuesBuilders.js';
import { renderedOutput } from '../../../../../../../support/renderedOutput.js';

describe('IssueHeaderHelper', () => {
  const outputOf = (project = buildProject(), issue = buildIssue()) => renderedOutput(
    React.createElement('div', null, IssueHeaderHelper.render(project, issue)),
  );

  it('links back to the project page, naming the project as text', () => {
    const output = outputOf(buildProject({ name: 'Kerghan' }));

    expect(output.containsAttribute('href', `#/projects/${PROJECT_ID}`)).toBe(true);
    expect(output.containsElement('a', 'Back to Kerghan')).toBe(true);
  });

  it('shows the title as the page heading, wrapping anywhere (U8)', () => {
    const tree = IssueHeaderHelper.render(buildProject(), buildIssue({ title: 'Fix the login' }));
    const [title] = findElements(tree, (node) => node.type === 'h1');

    expect(title.props.children).toBe('Fix the login');
    expect(title.props.style.overflowWrap).toBe('anywhere');
  });

  it('shows the Open or Closed badge', () => {
    expect(outputOf(buildProject(), buildIssue({ state: 'open' })).containsElement('span', 'Open')).toBe(true);
    expect(outputOf(buildProject(), buildIssue({ state: 'closed' })).containsElement('span', 'Closed')).toBe(true);
  });

  it('shows the created and updated dates', () => {
    const issue = buildIssue();
    const output = outputOf(buildProject(), issue);

    expect(output.contains(`Created ${new Date(issue.createdAt).toLocaleString()}`)).toBe(true);
    expect(output.contains(`Updated ${new Date(issue.updatedAt).toLocaleString()}`)).toBe(true);
  });

  it('renders the title and the project name as text, never as markup (S1)', () => {
    const output = outputOf(buildProject({ name: '<b>n</b>' }), buildIssue({ title: '<script>alert(1)</script>' }));

    expect(output.contains('<script>')).toBe(false);
    expect(output.contains('<b>')).toBe(false);
    expect(output.contains('&lt;script&gt;')).toBe(true);
  });
});
