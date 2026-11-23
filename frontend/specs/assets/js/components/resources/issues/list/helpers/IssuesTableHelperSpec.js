import React from 'react';
import IssuesTableHelper from '../../../../../../../../assets/js/components/resources/issues/list/helpers/IssuesTableHelper.jsx';
import { findElements } from '../../../../../../../support/elementTree.js';
import {
  buildIssue, buildLink, ISSUE_ID, PROJECT_ID,
} from '../../../../../../../support/issuesBuilders.js';
import { renderedOutput } from '../../../../../../../support/renderedOutput.js';

describe('IssuesTableHelper', () => {
  const noSelection = () => ({ selected: [], onToggle: jasmine.createSpy('onToggle'), onToggleAll: jasmine.createSpy('onToggleAll') });
  const treeOf = (issues) => IssuesTableHelper.render(PROJECT_ID, issues, noSelection());
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
      IssuesTableHelper.render('a/b', [buildIssue({ id: '../x' })], noSelection()), (node) => node.type === 'a',
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

  describe('selection', () => {
    const checkboxes = (issues, selection) => findElements(
      IssuesTableHelper.render(PROJECT_ID, issues, selection), (node) => node.type === 'input',
    );
    const selectionOf = (selected = []) => ({
      selected, onToggle: jasmine.createSpy('onToggle'), onToggleAll: jasmine.createSpy('onToggleAll'),
    });
    const [first, second] = [buildIssue({ id: 'a', title: 'First' }), buildIssue({ id: 'b', title: 'Second' })];

    it('renders a select-all checkbox in the header and one labelled checkbox per row', () => {
      const [all, ...rows] = checkboxes([first, second], selectionOf());

      expect(all.props['aria-label']).toBe('Select all issues on this page');
      expect(rows.map((row) => row.props['aria-label'])).toEqual(['Select First', 'Select Second']);
    });

    it('checks the selected rows only', () => {
      const [, a, b] = checkboxes([first, second], selectionOf(['a']));

      expect(a.props.checked).toBe(true);
      expect(b.props.checked).toBe(false);
    });

    it('checks select-all when every row is selected', () => {
      const [all] = checkboxes([first, second], selectionOf(['a', 'b']));

      expect(all.props.checked).toBe(true);
    });

    it('leaves select-all unchecked but indeterminate when only some rows are selected', () => {
      const [all] = checkboxes([first, second], selectionOf(['a']));
      const element = {};

      all.props.ref(element);

      expect(all.props.checked).toBe(false);
      expect(element.indeterminate).toBe(true);
    });

    it('is not indeterminate when none or all are selected', () => {
      const none = {};
      const every = {};

      checkboxes([first, second], selectionOf())[0].props.ref(none);
      checkboxes([first, second], selectionOf(['a', 'b']))[0].props.ref(every);

      expect(none.indeterminate).toBe(false);
      expect(every.indeterminate).toBe(false);
    });

    it('ignores a detached ref', () => {
      const [all] = checkboxes([first], selectionOf());

      expect(() => all.props.ref(null)).not.toThrow();
    });

    it('toggles a row and the whole page', () => {
      const selection = selectionOf();
      const [all, a] = checkboxes([first, second], selection);

      a.props.onChange();
      all.props.onChange();

      expect(selection.onToggle).toHaveBeenCalledOnceWith('a');
      expect(selection.onToggleAll).toHaveBeenCalledOnceWith(['a', 'b']);
    });

    it('escapes the title in the aria-label (S1)', () => {
      const output = outputOf([buildIssue({ title: '"><img src=x onerror=alert(1)>' })]);

      expect(output.contains('<img')).toBe(false);
      expect(output.contains('aria-label="Select &quot;&gt;&lt;img')).toBe(true);
    });
  });
});
