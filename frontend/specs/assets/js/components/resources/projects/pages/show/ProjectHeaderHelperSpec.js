import React from 'react';
import ProjectHeaderHelper from '../../../../../../../../assets/js/components/resources/projects/pages/show/ProjectHeaderHelper.jsx';
import { findElements } from '../../../../../../../support/elementTree.js';
import { buildProject, PROJECT_ID } from '../../../../../../../support/issuesBuilders.js';
import { renderedOutput } from '../../../../../../../support/renderedOutput.js';

describe('ProjectHeaderHelper', () => {
  const outputOf = (overrides) => renderedOutput(React.createElement('div', null, ProjectHeaderHelper.render(buildProject(overrides))));

  it('shows the name as the title', () => {
    expect(outputOf({ name: 'Kerghan' }).containsElement('h1', 'Kerghan')).toBe(true);
  });

  it('wraps long names anywhere (U8)', () => {
    const [title] = findElements(ProjectHeaderHelper.render(buildProject()), (node) => node.type === 'h1');

    expect(title.props.style.overflowWrap).toBe('anywhere');
  });

  it('shows the description as plain text', () => {
    expect(outputOf({ description: 'Issue monitoring' }).containsElement('p', 'Issue monitoring')).toBe(true);
  });

  it('shows no description paragraph without one', () => {
    expect(outputOf({ description: null }).containsTag('p')).toBe(false);
    expect(outputOf({ description: '' }).containsTag('p')).toBe(false);
  });

  it('shows the repository with its status badge', () => {
    const output = outputOf();

    expect(output.contains('darthjee/kerghan')).toBe(true);
    expect(output.containsElement('span', 'Added')).toBe(true);
  });

  it('shows "No repository" for a project without one', () => {
    expect(outputOf({ repository: null }).contains('No repository')).toBe(true);
  });

  it('offers an Edit action to the management page', () => {
    const output = outputOf();

    expect(output.containsAttribute('href', `#/projects/${PROJECT_ID}/edit`)).toBe(true);
    expect(output.containsElement('a', 'Edit')).toBe(true);
  });

  it('offers a New issue action to the issue creation form', () => {
    const output = outputOf();

    expect(output.containsAttribute('href', `#/projects/${PROJECT_ID}/issues/new`)).toBe(true);
    expect(output.containsElement('a', 'New issue')).toBe(true);
  });

  it('renders the name and description as text, never as markup (S1)', () => {
    const output = outputOf({ name: '<img src=x onerror=alert(1)>', description: '<script>alert(1)</script>' });

    expect(output.contains('<img')).toBe(false);
    expect(output.contains('<script>')).toBe(false);
    expect(output.contains('&lt;script&gt;')).toBe(true);
  });
});
