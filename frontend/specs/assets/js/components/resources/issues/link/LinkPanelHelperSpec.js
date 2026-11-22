import React from 'react';
import ConfirmModal from '../../../../../../../assets/js/components/common/confirmModal/ConfirmModal.jsx';
import AttachIssueModal from '../../../../../../../assets/js/components/resources/issues/link/modals/AttachIssueModal.jsx';
import LinkPanelHelper from '../../../../../../../assets/js/components/resources/issues/link/LinkPanelHelper.jsx';
import LinkStatePresenter from '../../../../../../../assets/js/components/resources/issues/link/linkStatePresenter.js';
import { buildLink, buildProjectRepository } from '../../../../../../support/issuesBuilders.js';
import { findButton, findElements } from '../../../../../../support/elementTree.js';
import { renderedOutput } from '../../../../../../support/renderedOutput.js';

describe('LinkPanelHelper', () => {
  const now = Date.parse('2026-11-07T12:00:00.000Z');
  const idle = { active: false, secondsLeft: 0, label: null };
  let handlers;

  beforeEach(() => {
    handlers = jasmine.createSpyObj('handlers', [
      'onRefresh', 'onRetrySync', 'onUnlink', 'onConfirmDiscard', 'onCancelDiscard', 'onAttach',
    ]);
  });

  const stateOf = (link, overrides = {}) => ({
    view: LinkStatePresenter.present(link, buildProjectRepository(), now),
    activity: null,
    notice: null,
    error: null,
    confirming: false,
    countdown: idle,
    ...overrides,
  });
  const render = (link, overrides) => LinkPanelHelper.render(stateOf(link, overrides), handlers);
  const output = (link, overrides) => renderedOutput(render(link, overrides));

  describe('unlinked', () => {
    it('shows the text and the attach button, which opens the attach flow', () => {
      const tree = render(null);

      expect(renderedOutput(tree).containsInOrder('Not linked to GitHub', 'Link to a GitHub issue')).toBe(true);
      findButton(tree, 'Link to a GitHub issue').props.onClick();
      expect(handlers.onAttach).toHaveBeenCalled();
    });

    it('shows the hint and no button when linking is not possible', () => {
      const view = LinkStatePresenter.present(null, null, now);
      const tree = LinkPanelHelper.render({ ...stateOf(null), view }, handlers);

      expect(renderedOutput(tree).contains('Connect a repository to link issues')).toBe(true);
      expect(findButton(tree, 'Link to a GitHub issue')).toBeUndefined();
    });
  });

  describe('linked', () => {
    it('shows the badge, the S2 link, the message and Refresh and Unlink', () => {
      const tree = render(buildLink({ lastSyncedAt: '2026-11-07T11:55:00.000Z' }));
      const rendered = renderedOutput(tree);

      expect(rendered.containsInOrder('Synced', '#12', 'Linked to GitHub #12 · last synced 5 min ago')).toBe(true);
      expect(rendered.containsAttribute('href', 'https://github.com/darthjee/kerghan/issues/12')).toBe(true);
      expect(rendered.containsAttribute('rel', 'noopener noreferrer')).toBe(true);
      expect(findButton(tree, 'Refresh')).toBeDefined();
      expect(findButton(tree, 'Unlink')).toBeDefined();
      expect(findButton(tree, 'Retry sync')).toBeUndefined();
    });

    it('S2: renders no link for a non-GitHub url', () => {
      const rendered = output(buildLink({ url: 'javascript:alert(1)' }));

      expect(rendered.contains('javascript:')).toBe(false);
      expect(rendered.containsTag('a')).toBe(false);
    });

    it('wires the buttons to the handlers', () => {
      const tree = render(buildLink());

      findButton(tree, 'Refresh').props.onClick();
      findButton(tree, 'Unlink').props.onClick();

      expect(handlers.onRefresh).toHaveBeenCalled();
      expect(handlers.onUnlink).toHaveBeenCalled();
    });

    it('shows Retry sync, not Refresh, for a failed sync, with the Fix link', () => {
      const tree = render(buildLink({ state: 'sync_failed', states: ['sync_failed'], reason: 'no_credential' }));
      const rendered = renderedOutput(tree);

      expect(findButton(tree, 'Retry sync')).toBeDefined();
      expect(findButton(tree, 'Refresh')).toBeUndefined();
      expect(rendered.contains('No GitHub credential can access this repository.')).toBe(true);
      expect(rendered.containsElement('a', 'Fix it in Integrations')).toBe(true);
      expect(rendered.contains('last synced')).toBe(true);
      findButton(tree, 'Retry sync').props.onClick();
      expect(handlers.onRetrySync).toHaveBeenCalled();
    });

    it('shows secondary lines under the primary message', () => {
      const rendered = output(buildLink({ state: 'sync_failed', states: ['sync_failed', 'pending'], reason: 'retries_exhausted' }));

      expect(rendered.containsInOrder('Sync failed', 'Sync failed after several attempts.', 'Pending', 'Changes are waiting to be sent to GitHub.')).toBe(true);
    });

    it('shows Unlink only for a gone issue, with no last synced', () => {
      const tree = render(buildLink({ state: 'gone', states: ['gone'], reason: 'deleted' }));

      expect(findButton(tree, 'Unlink')).toBeDefined();
      expect(findButton(tree, 'Refresh')).toBeUndefined();
      expect(renderedOutput(tree).contains('last synced')).toBe(false);
    });

    it('links to the repositories for an unavailable repository', () => {
      const rendered = output(buildLink({ state: 'repository_unavailable', states: ['repository_unavailable'] }));

      expect(rendered.containsAttribute('href', '#/repositories')).toBe(true);
    });
  });

  describe('activity and U2', () => {
    it('reads Refreshing... and disables every button while refreshing', () => {
      const tree = render(buildLink(), { activity: 'refresh' });

      expect(findButton(tree, 'Refreshing…').props.disabled).toBeTrue();
      expect(findButton(tree, 'Unlink').props.disabled).toBeTrue();
    });

    it('reads Retrying... while retrying', () => {
      const tree = render(buildLink({ state: 'sync_failed', states: ['sync_failed'] }), { activity: 'retrySync' });

      expect(findButton(tree, 'Retrying…').props.disabled).toBeTrue();
    });

    it('disables Unlink while unlinking', () => {
      const tree = render(buildLink(), { activity: 'unlink' });

      expect(findButton(tree, 'Unlink').props.disabled).toBeTrue();
      expect(findButton(tree, 'Refresh').props.disabled).toBeTrue();
    });

    it('is enabled when idle', () => {
      const tree = render(buildLink());

      expect(findButton(tree, 'Refresh').props.disabled).toBeFalse();
      expect(findButton(tree, 'Unlink').props.disabled).toBeFalse();
    });

    it('shows the rate-limit countdown on Refresh and disables it, leaving Unlink enabled', () => {
      const tree = render(buildLink(), { countdown: { active: true, secondsLeft: 4, label: 'Try again in 4 s' } });

      expect(findButton(tree, 'Try again in 4 s').props.disabled).toBeTrue();
      expect(findButton(tree, 'Unlink').props.disabled).toBeFalse();
    });
  });

  describe('notice, error and confirmation', () => {
    it('shows the notice', () => {
      expect(output(buildLink(), { notice: 'Already up to date' }).contains('Already up to date')).toBe(true);
    });

    it('shows the described error as text (S1)', () => {
      const rendered = output(buildLink(), { error: { message: '<b>x</b>' } });

      expect(rendered.contains('&lt;b&gt;x&lt;/b&gt;')).toBe(true);
      expect(rendered.contains('<b>')).toBe(false);
    });

    it('E63: shows the discard confirmation, named for the action, wired to the handlers', () => {
      const tree = render(buildLink(), { confirming: true });
      const [modal] = findElements(tree, (node) => node.type === ConfirmModal);

      expect(modal.props.message).toBe('This issue has changes not yet sent to GitHub. Unlinking discards them.');
      expect(modal.props.confirmLabel).toBe('Unlink and discard');
      expect(modal.props.danger).toBeTrue();
      modal.props.onConfirm();
      modal.props.onCancel();
      expect(handlers.onConfirmDiscard).toHaveBeenCalled();
      expect(handlers.onCancelDiscard).toHaveBeenCalled();
    });

    it('shows no confirmation by default', () => {
      expect(findElements(render(buildLink()), (node) => node.type === ConfirmModal)).toEqual([]);
    });
  });

  describe('attach modal', () => {
    const attachHandlers = () => ({
      ...handlers, onIssueChange: () => undefined, onReread: () => undefined, onNotFound: () => undefined, onCloseAttach: () => undefined,
    });
    const attachState = (attaching) => ({
      ...stateOf(null), attaching, projectId: 'p', issue: { id: 'i' }, repository: buildProjectRepository(),
    });

    it('is shown, with what it needs, while attaching', () => {
      const tree = LinkPanelHelper.render(attachState(true), attachHandlers());
      const [modal] = findElements(tree, (node) => node.type === AttachIssueModal);

      expect(modal.props.projectId).toBe('p');
      expect(modal.props.issue).toEqual({ id: 'i' });
      expect(modal.props.repository).toEqual(buildProjectRepository());
    });

    it('is not shown otherwise', () => {
      const tree = LinkPanelHelper.render(attachState(false), attachHandlers());

      expect(findElements(tree, (node) => node.type === AttachIssueModal)).toEqual([]);
    });
  });

  it('renders a React element', () => {
    expect(React.isValidElement(render(null))).toBe(true);
  });
});
