import React from 'react';
import ConfirmModal from '../../../../../../../../assets/js/components/common/confirmModal/ConfirmModal.jsx';
import IssueActionsHelper from '../../../../../../../../assets/js/components/resources/issues/pages/show/IssueActionsHelper.jsx';
import { findElements } from '../../../../../../../support/elementTree.js';
import {
  buildIssue, buildLink, ISSUE_ID, PROJECT_ID,
} from '../../../../../../../support/issuesBuilders.js';
import { renderedOutput } from '../../../../../../../support/renderedOutput.js';

describe('IssueActionsHelper', () => {
  const handlers = {
    onToggle: jasmine.createSpy('onToggle'),
    onOpenDelete: jasmine.createSpy('onOpenDelete'),
    onDelete: jasmine.createSpy('onDelete'),
    onCancel: jasmine.createSpy('onCancel'),
  };
  const idle = { active: false, label: null };
  const treeOf = (overrides = {}, issueOverrides = {}) => IssueActionsHelper.render({
    projectId: PROJECT_ID,
    issue: buildIssue(issueOverrides),
    busy: false,
    error: null,
    confirming: false,
    countdown: idle,
    ...overrides,
  }, handlers);
  const outputOf = (...args) => renderedOutput(React.createElement('div', null, treeOf(...args)));
  const buttonOf = (tree, label) => findElements(tree, (node) => node.type === 'button' && node.props.children === label)[0];

  it('links Edit to the edit form', () => {
    const output = outputOf();

    expect(output.containsAttribute('href', `#/projects/${PROJECT_ID}/issues/${ISSUE_ID}/edit`)).toBe(true);
    expect(output.containsElement('a', 'Edit')).toBe(true);
  });

  it('offers "Close issue" for an open issue and "Reopen issue" for a closed one', () => {
    expect(buttonOf(treeOf(), 'Close issue').props.onClick).toBe(handlers.onToggle);
    expect(buttonOf(treeOf({}, { state: 'closed' }), 'Reopen issue').props.onClick).toBe(handlers.onToggle);
  });

  it('U2: disables the buttons while a call is in flight', () => {
    const tree = treeOf({ busy: true });

    expect(buttonOf(tree, 'Close issue').props.disabled).toBe(true);
    expect(buttonOf(tree, 'Delete').props.disabled).toBe(true);
  });

  it('shows the rate-limit countdown on the state button and disables it', () => {
    const button = buttonOf(treeOf({ countdown: { active: true, label: 'Try again in 5 s' } }), 'Try again in 5 s');

    expect(button.props.disabled).toBe(true);
  });

  it('disables Delete for a linked issue, with the hint', () => {
    const tree = treeOf({}, { link: buildLink() });

    expect(buttonOf(tree, 'Delete').props.disabled).toBe(true);
    expect(renderedOutput(React.createElement('div', null, tree)).contains('Unlink this issue before deleting it')).toBe(true);
  });

  it('enables Delete for an unlinked issue, with no hint', () => {
    const output = outputOf();

    expect(buttonOf(treeOf(), 'Delete').props.disabled).toBe(false);
    expect(output.contains('Unlink this issue')).toBe(false);
  });

  it('opens the confirmation from Delete', () => {
    expect(buttonOf(treeOf(), 'Delete').props.onClick).toBe(handlers.onOpenDelete);
  });

  it('shows the Delete confirmation only while it is open', () => {
    expect(findElements(treeOf(), (node) => node.type === ConfirmModal)).toEqual([]);

    const [modal] = findElements(treeOf({ confirming: true }), (node) => node.type === ConfirmModal);

    expect(modal.props).toEqual(jasmine.objectContaining({
      title: 'Delete issue',
      message: 'Delete this issue? This cannot be undone.',
      confirmLabel: 'Delete issue',
      danger: true,
      onConfirm: handlers.onDelete,
      onCancel: handlers.onCancel,
    }));
  });

  it('shows the action error as text, and nothing without one', () => {
    expect(outputOf().containsAttribute('role', 'alert')).toBe(false);

    const output = outputOf({ error: { message: '<script>x</script>' } });

    expect(output.containsAttribute('role', 'alert')).toBe(true);
    expect(output.contains('<script>')).toBe(false);
  });
});
