import ConfirmModal from '../../../../common/confirmModal/ConfirmModal.jsx';
import DescribedError from '../../../projects/DescribedError.jsx';
import ProjectPaths from '../../../projects/paths.js';

const LINKED_HINT = 'Unlink this issue before deleting it';
const DELETE_MESSAGE = 'Delete this issue? This cannot be undone.';

/**
 * Label of the Close or Reopen button.
 *
 * @param {{state: string}} issue - The issue.
 * @param {{active: boolean, label: (string|null)}} countdown - The rate-limit countdown.
 * @returns {string} The countdown label while it runs, otherwise the action's name.
 */
function stateLabel(issue, countdown) {
  if (countdown.active) {
    return countdown.label;
  }

  return issue.state === 'open' ? 'Close issue' : 'Reopen issue';
}

/**
 * Render the action error, shown only when there is one.
 *
 * @param {(object|null)} error - The described action error.
 * @returns {React.ReactElement|null} The error, or `null` without one.
 */
function renderError(error) {
  if (error === null) {
    return null;
  }

  return <DescribedError error={error} className="alert alert-danger mt-3" role="alert" />;
}

/**
 * Render the Delete confirmation, shown only while it is open.
 *
 * @param {boolean} confirming - Whether the confirmation is open.
 * @param {{onDelete: Function, onCancel: Function}} handlers - Event handlers.
 * @returns {React.ReactElement|null} The modal, or `null` while closed.
 */
function renderConfirm(confirming, handlers) {
  if (!confirming) {
    return null;
  }

  return (
    <ConfirmModal
      title="Delete issue"
      message={DELETE_MESSAGE}
      confirmLabel="Delete issue"
      danger
      onConfirm={handlers.onDelete}
      onCancel={handlers.onCancel}
    />
  );
}

/**
 * Render the hint of a Delete that is disabled because the issue is linked.
 *
 * @param {boolean} linked - Whether the issue has a GitHub link.
 * @returns {React.ReactElement|null} The hint, or `null` for an unlinked issue.
 */
function renderLinkedHint(linked) {
  return linked ? <span className="text-muted small ms-2">{LINKED_HINT}</span> : null;
}

/**
 * Rendering helper of the issue page's actions: Edit, Close or Reopen, and Delete.
 */
const IssueActionsHelper = {
  /**
   * Render the actions. Every button is disabled while its call is in flight (U2).
   *
   * @param {{projectId: string, issue: object, busy: boolean, error: (object|null),
   *   confirming: boolean, countdown: {active: boolean, label: (string|null)}}} state -
   *   Section state.
   * @param {{onToggle: Function, onOpenDelete: Function, onDelete: Function,
   *   onCancel: Function}} handlers - Event handlers.
   * @returns {React.ReactElement} The actions.
   */
  render(state, handlers) {
    const {
      projectId, issue, busy, error, confirming, countdown,
    } = state;
    const linked = issue.link !== null;

    return (
      <section className="mt-4">
        <div className="d-flex flex-wrap align-items-center gap-2">
          <a className="btn btn-primary" href={ProjectPaths.editIssue(projectId, issue.id)}>Edit</a>
          <button
            type="button"
            className="btn btn-outline-secondary"
            disabled={busy || countdown.active}
            onClick={handlers.onToggle}
          >
            {stateLabel(issue, countdown)}
          </button>
          <button type="button" className="btn btn-outline-danger" disabled={linked || busy} onClick={handlers.onOpenDelete}>
            Delete
          </button>
          {renderLinkedHint(linked)}
        </div>
        {renderError(error)}
        {renderConfirm(confirming, handlers)}
      </section>
    );
  },
};

export default IssueActionsHelper;
