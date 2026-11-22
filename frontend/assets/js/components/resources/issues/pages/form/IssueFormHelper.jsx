import ProjectFieldsHelper from '../../../projects/pages/common/ProjectFieldsHelper.jsx';
import IssueChangedBanner from './IssueChangedBanner.jsx';
import IssueFieldsHelper from './IssueFieldsHelper.jsx';

/**
 * Render what the edit form tells about the issue's GitHub link, when it has one.
 *
 * @param {({number: number, state: string}|null)} link - The issue's link.
 * @returns {React.ReactElement|null} The note, or `null` for an unlinked issue.
 */
function renderLinkNote(link) {
  if (link === null) {
    return null;
  }

  const text = link.state === 'gone'
    ? 'The GitHub issue is gone; changes stay in Kerghan.'
    : `Changes are sent to GitHub issue #${link.number}`;

  return <p className="alert alert-info">{text}</p>;
}

/**
 * Label of the submit button.
 *
 * @param {{mode: string, countdown: {active: boolean, label: (string|null)}}} state - Form
 *   state.
 * @returns {string} The countdown label while a rate limit runs, otherwise the action's name.
 */
function submitLabel({ mode, countdown }) {
  if (countdown.active) {
    return countdown.label;
  }

  return mode === 'new' ? 'Create issue' : 'Save';
}

/**
 * Render the State field, on the edit form only.
 *
 * @param {object} state - Form state.
 * @param {object} handlers - Event handlers.
 * @returns {React.ReactElement|null} The field, or `null` on the creation form.
 */
function renderState(state, handlers) {
  return state.mode === 'edit' ? IssueFieldsHelper.renderState(state, handlers) : null;
}

/**
 * Rendering helper of the issue create and edit forms: the fields, the form-level error, and
 * Save (or Create) and Cancel.
 */
const IssueFormHelper = {
  /**
   * Render the form. The submit button is disabled while a call is in flight (U2) or a rate
   * limit runs.
   *
   * @param {{mode: string, title: string, body: string, state: string, tab: string,
   *   link: (object|null), changed: (boolean|undefined), fieldErrors: object,
   *   formError: (object|null), submitting: boolean, countdown: {active: boolean, label:
   *   (string|null)}}} state - Form state; `mode` is `new` or `edit`; `changed` shows the U10
   *   banner.
   * @param {{onTitleChange: Function, onBodyChange: Function, onStateChange: Function,
   *   onTabChange: Function, onSubmit: Function, onCancel: Function,
   *   onDiscardAndReload: Function}} handlers - Event handlers.
   * @returns {React.ReactElement} The form.
   */
  render(state, handlers) {
    const edit = state.mode === 'edit';

    return (
      <div className="container mt-4">
        <h1>{edit ? 'Edit issue' : 'New issue'}</h1>
        {edit ? renderLinkNote(state.link) : null}
        {edit ? <IssueChangedBanner visible={state.changed} onDiscard={handlers.onDiscardAndReload} /> : null}
        <form onSubmit={handlers.onSubmit} noValidate>
          {ProjectFieldsHelper.renderFormError(state.formError)}
          {IssueFieldsHelper.renderTitle(state, handlers)}
          {IssueFieldsHelper.renderBody(state, handlers)}
          {renderState(state, handlers)}
          <button type="submit" className="btn btn-primary me-2" disabled={state.submitting || state.countdown.active}>
            {state.submitting ? <span className="spinner-border spinner-border-sm me-1" role="status" aria-label="Saving" /> : null}
            {submitLabel(state)}
          </button>
          <button type="button" className="btn btn-outline-secondary" disabled={state.submitting} onClick={handlers.onCancel}>
            Cancel
          </button>
        </form>
      </div>
    );
  },
};

export default IssueFormHelper;
