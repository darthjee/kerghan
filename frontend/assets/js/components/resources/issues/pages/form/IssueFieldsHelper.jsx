import IssueBody from '../../body/IssueBody.jsx';
import ProjectFieldsHelper from '../../../projects/pages/common/ProjectFieldsHelper.jsx';

const TABS = [['write', 'Write'], ['preview', 'Preview']];

/**
 * Render the Write and Preview tabs of the body field.
 *
 * @param {string} tab - The selected tab, `write` or `preview`.
 * @param {{onTabChange: Function}} handlers - Event handlers.
 * @returns {React.ReactElement} The tabs.
 */
function renderTabs(tab, handlers) {
  return (
    <ul className="nav nav-tabs mb-2" role="tablist">
      {TABS.map(([name, label]) => (
        <li className="nav-item" key={name} role="presentation">
          <button
            type="button"
            role="tab"
            aria-selected={tab === name}
            className={`nav-link${tab === name ? ' active' : ''}`}
            onClick={() => handlers.onTabChange(name)}
          >
            {label}
          </button>
        </li>
      ))}
    </ul>
  );
}

/**
 * Render the body's editor or its preview, whichever tab is selected. The preview mounts
 * `IssueBody` only while its tab is selected (P3); the textarea never trims what is typed.
 *
 * @param {{body: string, tab: string, fieldErrors: object}} state - Form state.
 * @param {{onBodyChange: Function}} handlers - Event handlers.
 * @returns {React.ReactElement} The textarea, or the preview.
 */
function renderBodyPane(state, handlers) {
  if (state.tab === 'preview') {
    return <div className="border rounded p-3 mb-2" style={{ overflowWrap: 'anywhere' }}><IssueBody body={state.body} /></div>;
  }

  return (
    <textarea
      id="issue-body"
      rows={10}
      className={`form-control${state.fieldErrors.body ? ' is-invalid' : ''}`}
      value={state.body}
      onChange={handlers.onBodyChange}
    />
  );
}

/**
 * Rendering helper of the fields of the issue forms (creation and edit): Title, Body (Write and
 * Preview) and, on the edit form, State.
 */
const IssueFieldsHelper = {
  /**
   * Render the Title field.
   *
   * @param {{title: string, fieldErrors: object}} state - Form state.
   * @param {{onTitleChange: Function}} handlers - Event handlers.
   * @returns {React.ReactElement} The field.
   */
  renderTitle(state, handlers) {
    return (
      <div className="mb-3">
        <label className="form-label" htmlFor="issue-title">Title</label>
        <input
          id="issue-title"
          type="text"
          className={`form-control${state.fieldErrors.title ? ' is-invalid' : ''}`}
          value={state.title}
          onChange={handlers.onTitleChange}
        />
        {ProjectFieldsHelper.renderFieldError(state.fieldErrors.title)}
      </div>
    );
  },

  /**
   * Render the Body field, with its Write and Preview tabs.
   *
   * @param {{body: string, tab: string, fieldErrors: object}} state - Form state.
   * @param {{onBodyChange: Function, onTabChange: Function}} handlers - Event handlers.
   * @returns {React.ReactElement} The field.
   */
  renderBody(state, handlers) {
    return (
      <div className="mb-3">
        <label className="form-label" htmlFor="issue-body">Body</label>
        {renderTabs(state.tab, handlers)}
        {renderBodyPane(state, handlers)}
        {ProjectFieldsHelper.renderFieldError(state.fieldErrors.body)}
      </div>
    );
  },

  /**
   * Render the State field (edit form only).
   *
   * @param {{state: string}} state - Form state.
   * @param {{onStateChange: Function}} handlers - Event handlers.
   * @returns {React.ReactElement} The field.
   */
  renderState(state, handlers) {
    return (
      <div className="mb-3">
        <label className="form-label" htmlFor="issue-state">State</label>
        <select id="issue-state" className="form-select w-auto" value={state.state} onChange={handlers.onStateChange}>
          <option value="open">Open</option>
          <option value="closed">Closed</option>
        </select>
      </div>
    );
  },
};

export default IssueFieldsHelper;
