import React from 'react';
import IssuesTableHelper from '../../../../../../../../assets/js/components/resources/issues/list/helpers/IssuesTableHelper.jsx';
import { findElements } from '../../../../../../../support/elementTree.js';
import {
  buildIssue, buildLink, ISSUE_ID, PROJECT_ID,
} from '../../../../../../../support/issuesBuilders.js';
import { renderedOutput } from '../../../../../../../support/renderedOutput.js';

describe('IssuesTableHelper', () => {
  const treeOf = (issues) => IssuesTableHelper.render(PROJECT_ID, issues);
  const outputOf = (issues) => renderedOutput(React.createElement('div', null, treeOf(issues)));

  it('renders the Title, State, Created and GitHub columns, and no body', () => {
    const output = outputOf([buildIssue({ body: 'Secret body' })]);

    ['Title', 'State', 'Created', 'GitHub'].forEach((column) => {
      expect(output.containsElement('th', column)).toBe(true);
    });
    expect(output.contains('Secret body')).toBe(false);
  });

  it('links the title to the issue page, with the full title in title (U8)', () => {
    const [anchor] = findElements(treeOf([buildIssue({ title: 'A very long title' })]), (node) => node.type === 'a');

    expect(anchor.props.href).toBe(`#/projects/${PROJECT_ID}/issues/${ISSUE_ID}`);
    expect(anchor.props.title).toBe('A very long title');
    expect(anchor.props.className).toContain('text-truncate');
    expect(anchor.props.style.overflowWrap).toBe('anywhere');
  });

  it('encodes both ids in the link', () => {
    const [anchor] = findElements(
      IssuesTableHelper.render('a/b', [buildIssue({ id: '../x' })]), (node) => node.type === 'a',
    );

    expect(anchor.props.href).toBe('#/projects/a%2Fb/issues/..%2Fx');
  });

  it('renders a title as text, never as markup (S1)', () => {
    const output = outputOf([buildIssue({ title: '<img src=x onerror=alert(1)>' })]);

    expect(output.contains('<img')).toBe(false);
    expect(output.contains('&lt;img')).toBe(true);
  });

  it('shows the Open and Closed badges', () => {
    expect(outputOf([buildIssue({ state: 'open' })]).containsElement('span', 'Open')).toBe(true);
    expect(outputOf([buildIssue({ state: 'closed' })]).containsElement('span', 'Closed')).toBe(true);
  });

  it('shows the created date', () => {
    const issue = buildIssue();

    expect(outputOf([issue]).contains(new Date(issue.createdAt).toLocaleDateString())).toBe(true);
  });

  it('shows a dash for an unlinked issue and the link column of a linked one', () => {
    expect(outputOf([buildIssue()]).contains('—')).toBe(true);
    expect(outputOf([buildIssue({ link: buildLink() })]).containsElement('a', '#12')).toBe(true);
  });

  it('renders one row per issue', () => {
    const rows = findElements(
      treeOf([buildIssue({ id: 'a' }), buildIssue({ id: 'b' })]),
      (node) => node.type === 'tr' && node.key !== null,
    );

    expect(rows.length).toBe(2);
  });
});
