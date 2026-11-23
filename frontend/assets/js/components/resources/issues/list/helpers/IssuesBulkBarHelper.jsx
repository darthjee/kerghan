import DescribedError from '../../../projects/DescribedError.jsx';

/**
 * Label of one bulk button.
 *
 * @param {string} label - The button's own label (`Close selected` or `Reopen selected`).
 * @param {{active: boolean, label: (string|null)}} countdown - The rate-limit countdown.
 * @returns {string} The countdown label while it runs, otherwise `label`.
 */
function buttonLabel(label, countdown) {
  return countdown.active ? countdown.label : label;
}

/**
 * Render one bulk button: disabled while a call is in flight (U2) or the countdown runs, with a
 * spinner while its own call is in flight.
 *
 * @param {{label: string, target: string, onClick: Function}} button - The button's label,
 *   the state it applies and its click handler.
 * @param {{inFlight: boolean, target: (string|null), countdown: object}} bulk - Bulk state.
 * @returns {React.ReactElement} The button.
 */
function renderButton({ label, target, onClick }, bulk) {
  const spinning = bulk.inFlight && bulk.target === target;

  return (
    <button
      type="button"
      className="btn btn-sm btn-outline-secondary"
      disabled={bulk.inFlight || bulk.countdown.active}
      onClick={onClick}
    >
      {spinning ? <span className="spinner-border spinner-border-sm me-1" role="status" aria-label="Applying" /> : null}
      {buttonLabel(label, bulk.countdown)}
    </button>
  );
}

/**
 * Render the inline bulk error, shown only when there is one.
 *
 * @param {(object|null)} error - The described bulk error.
 * @returns {React.ReactElement|null} The error, or `null` without one.
 */
function renderError(error) {
  if (error === null) {
    return null;
  }

  return <DescribedError error={error} className="text-danger small" role="alert" />;
}

/**
 * Rendering helper for the issue list's bulk bar: the selected count and the Close and Reopen
 * buttons.
 */
const IssuesBulkBarHelper = {
  /**
   * Render the bar.
   *
   * @param {{selected: Array<string>, inFlight: boolean, target: (string|null),
   *   error: (object|null), countdown: {active: boolean, label: (string|null)}}} bulk - Bulk
   *   state.
   * @param {{onBulkClose: Function, onBulkReopen: Function}} handlers - Event handlers.
   * @returns {React.ReactElement|null} The bar, or `null` while nothing is selected.
   */
  render(bulk, handlers) {
    if (bulk.selected.length === 0) {
      return null;
    }

    return (
      <div className="d-flex flex-wrap align-items-center gap-2 mb-3" role="toolbar" aria-label="Bulk actions">
        <span>{`${bulk.selected.length} selected`}</span>
        {renderButton({ label: 'Close selected', target: 'closed', onClick: handlers.onBulkClose }, bulk)}
        {renderButton({ label: 'Reopen selected', target: 'open', onClick: handlers.onBulkReopen }, bulk)}
        {renderError(bulk.error)}
      </div>
    );
  },
};

export default IssuesBulkBarHelper;
