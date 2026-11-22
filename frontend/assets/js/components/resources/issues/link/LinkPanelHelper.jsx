import ConfirmModal from '../../../common/confirmModal/ConfirmModal.jsx';
import DescribedError from '../../projects/DescribedError.jsx';
import GithubLink from './GithubLink.jsx';
import LinkStateBadge from './LinkStateBadge.jsx';
import AttachIssueModal from './modals/AttachIssueModal.jsx';

const DISCARD_MESSAGE = 'This issue has changes not yet sent to GitHub. Unlinking discards them.';

/**
 * Label of the Refresh or Retry sync button.
 *
 * @param {string} idle - The button's own name.
 * @param {string} busy - The label while its call or re-read is running.
 * @param {string} action - The action this button runs.
 * @param {{activity: (string|null), countdown: {active: boolean, label: (string|null)}}} state -
 *   Panel state.
 * @returns {string} The busy label while this action is active, the countdown label while a
 *   rate limit runs, otherwise the idle name.
 */
function labelOf(idle, busy, action, state) {
  if (state.activity === action) {
    return busy;
  }

  return state.countdown.active ? state.countdown.label : idle;
}

/**
 * Render one action button; every button is disabled while any call is in flight (U2).
 *
 * @param {string} label - The button's text.
 * @param {boolean} disabled - Whether the button is disabled.
 * @param {Function} onClick - Click handler.
 * @param {string} [className] - Bootstrap button classes.
 * @returns {React.ReactElement} The button.
 */
function renderButton(label, disabled, onClick, className = 'btn btn-outline-secondary btn-sm') {
  return (
    <button key={label} type="button" className={className} disabled={disabled} onClick={onClick}>
      {label}
    </button>
  );
}

/**
 * Renderers of each action, by the presenter's action name.
 *
 * @type {Map<string, Function>}
 */
const ACTIONS = new Map([
  ['refresh', (state, handlers) => renderButton(
    labelOf('Refresh', 'Refreshing…', 'refresh', state),
    state.activity !== null || state.countdown.active,
    handlers.onRefresh,
  )],
  ['retrySync', (state, handlers) => renderButton(
    labelOf('Retry sync', 'Retrying…', 'retrySync', state),
    state.activity !== null || state.countdown.active,
    handlers.onRetrySync,
  )],
  ['unlink', (state, handlers) => renderButton(
    'Unlink',
    state.activity !== null,
    handlers.onUnlink,
    'btn btn-outline-danger btn-sm',
  )],
]);

/**
 * Render a message with its optional link.
 *
 * @param {{text: string, link: ({href: string, text: string}|undefined)}} message - The message.
 * @returns {React.ReactElement} The message as text (S1), followed by its link when it has one.
 */
function renderMessage(message) {
  return (
    <>
      {message.text}
      {message.link ? <>{' '}<a href={message.link.href}>{message.link.text}</a></> : null}
    </>
  );
}

/**
 * Render the secondary lines, one per extra state of the link.
 *
 * @param {Array<{state: string, text: string, link: (object|undefined)}>} lines - The lines.
 * @returns {React.ReactElement[]} The lines.
 */
function renderSecondary(lines) {
  return lines.map((line) => (
    <div key={line.state} className="d-flex align-items-center gap-2 small text-muted mt-1">
      <LinkStateBadge state={line.state} />
      <span>{renderMessage(line)}</span>
    </div>
  ));
}

/**
 * Render the "last synced" line, when the message does not carry it already.
 *
 * @param {(string|null)} lastSynced - The text, or `null`.
 * @returns {React.ReactElement|null} The line, or `null`.
 */
function renderLastSynced(lastSynced) {
  return lastSynced === null ? null : <div className="small text-muted mt-1">{lastSynced}</div>;
}

/**
 * Render the "Already up to date" notice, shown only while there is one.
 *
 * @param {(string|null)} notice - The notice text.
 * @returns {React.ReactElement|null} The notice, or `null`.
 */
function renderNotice(notice) {
  return notice === null ? null : <div className="alert alert-info py-1 mt-2 mb-0" role="status">{notice}</div>;
}

/**
 * Render the action error, shown only while there is one.
 *
 * @param {(object|null)} error - The described error.
 * @returns {React.ReactElement|null} The error, or `null`.
 */
function renderError(error) {
  return error === null ? null : <DescribedError error={error} className="alert alert-danger py-1 mt-2 mb-0" role="alert" />;
}

/**
 * Render the discard confirmation, shown only while it is open (E63).
 *
 * @param {boolean} confirming - Whether it is open.
 * @param {{onConfirmDiscard: Function, onCancelDiscard: Function}} handlers - Event handlers.
 * @returns {React.ReactElement|null} The modal, or `null`.
 */
function renderConfirm(confirming, handlers) {
  if (!confirming) {
    return null;
  }

  return (
    <ConfirmModal
      title="Unlink issue"
      message={DISCARD_MESSAGE}
      confirmLabel="Unlink and discard"
      danger
      onConfirm={handlers.onConfirmDiscard}
      onCancel={handlers.onCancelDiscard}
    />
  );
}

/**
 * Render the attach modal, shown only while it is open.
 *
 * @param {{attaching: boolean, projectId: string, issue: object, repository: object}} state -
 *   Panel state.
 * @param {{onIssueChange: Function, onReread: Function, onNotFound: Function,
 *   onCloseAttach: Function}} handlers - Event handlers.
 * @returns {React.ReactElement|null} The modal, or `null` while closed.
 */
function renderAttach(state, handlers) {
  if (!state.attaching) {
    return null;
  }

  return (
    <AttachIssueModal
      projectId={state.projectId}
      issue={state.issue}
      repository={state.repository}
      onIssueChange={handlers.onIssueChange}
      onReread={handlers.onReread}
      onNotFound={handlers.onNotFound}
      onClose={handlers.onCloseAttach}
    />
  );
}

/**
 * Render the view of an unlinked issue: the text, and either the attach button or the hint.
 *
 * @param {{text: string, canAttach: boolean, hint: (string|null)}} view - The presenter's view.
 * @param {{onAttach: Function}} handlers - Event handlers.
 * @returns {React.ReactElement} The row.
 */
function renderUnlinked(view, handlers) {
  return (
    <div className="d-flex flex-wrap align-items-center gap-2">
      <span>{view.text}</span>
      {view.canAttach ? renderButton('Link to a GitHub issue', false, handlers.onAttach, 'btn btn-outline-primary btn-sm') : null}
      {view.hint ? <span className="text-muted small">{view.hint}</span> : null}
    </div>
  );
}

/**
 * Render the view of a linked issue: badge, `#N`, messages and actions.
 *
 * @param {object} state - Panel state.
 * @param {{view: object}} state.view - The presenter's view.
 * @param {object} handlers - Event handlers.
 * @returns {React.ReactElement} The rows.
 */
function renderLinked(state, handlers) {
  const { view } = state;

  return (
    <>
      <div className="d-flex flex-wrap align-items-center gap-2">
        <LinkStateBadge state={view.state} />
        <GithubLink number={view.number} url={view.url} />
        <span>{renderMessage(view.message)}</span>
      </div>
      {renderSecondary(view.secondary)}
      {renderLastSynced(view.lastSynced)}
      <div className="d-flex flex-wrap gap-2 mt-2">
        {view.actions.map((action) => ACTIONS.get(action)(state, handlers))}
      </div>
    </>
  );
}

/**
 * Rendering helper of the link panel.
 */
const LinkPanelHelper = {
  /**
   * Render the panel.
   *
   * @param {{view: object, activity: (string|null), notice: (string|null), error: (object|null),
   *   confirming: boolean, attaching: boolean, countdown: {active: boolean, label: (string|null)},
   *   projectId: string, issue: object, repository: (object|null)}} state - Panel state: the
   *   presenter's view, the active action, the notice, the described error, whether the discard
   *   confirmation and the attach modal are open, the rate-limit countdown, and what the attach
   *   modal needs (the project's uuid, the issue and the repository).
   * @param {{onRefresh: Function, onRetrySync: Function, onUnlink: Function,
   *   onConfirmDiscard: Function, onCancelDiscard: Function, onAttach: Function,
   *   onCloseAttach: Function, onIssueChange: Function, onReread: Function,
   *   onNotFound: Function}} handlers - Event handlers.
   * @returns {React.ReactElement} The panel.
   */
  render(state, handlers) {
    return (
      <section className="card card-body mt-3" aria-label="GitHub link">
        {state.view.linked ? renderLinked(state, handlers) : renderUnlinked(state.view, handlers)}
        {renderNotice(state.notice)}
        {renderError(state.error)}
        {renderConfirm(state.confirming, handlers)}
        {renderAttach(state, handlers)}
      </section>
    );
  },
};

export default LinkPanelHelper;
