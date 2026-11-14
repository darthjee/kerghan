import FormFieldsHelper from '../../../../common/forms/helpers/FormFieldsHelper.jsx';

const INPUT_ID = 'my-account-github-handle';
const HELP_TEXT = 'Your public GitHub repositories are listed on the Repositories page. Leave empty to remove it.';

/**
 * Render the handle text input with its inline error, if any.
 *
 * @param {{handle: string, fieldError: (string|null)}} state - Section state.
 * @param {boolean} disabled - Whether the input is disabled.
 * @param {Function} onChange - Change handler for the input.
 * @returns {React.ReactElement} The labeled input with its help text.
 */
function renderInput(state, disabled, onChange) {
  return (
    <div className="mb-3">
      <label className="form-label" htmlFor={INPUT_ID}>GitHub handle</label>
      <input
        id={INPUT_ID}
        type="text"
        className={`form-control${state.fieldError ? ' is-invalid' : ''}`}
        value={state.handle}
        disabled={disabled}
        onChange={onChange}
      />
      {state.fieldError && <div className="invalid-feedback">{state.fieldError}</div>}
      <div className="form-text">{HELP_TEXT}</div>
    </div>
  );
}

/**
 * Rendering helper for the "GitHub handle" section of the My Account page.
 */
const GithubHandleHelper = {
  /**
   * Render the GitHub handle section: its own small form, separate from the account form. The
   * input and the Save button are disabled while loading, while saving, or when the load failed.
   *
   * @param {{handle: string, loading: boolean, loadError: (string|null),
   *   fieldError: (string|null), submitError: (string|null), successMessage: (string|null),
   *   saving: boolean}} state - Section state.
   * @param {{onSubmit: Function, onChange: Function}} handlers - Event handlers.
   * @returns {React.ReactElement} The rendered section.
   */
  render(state, handlers) {
    const disabled = state.loading || state.saving || Boolean(state.loadError);
    const alertState = {
      submitError: state.loadError || state.submitError,
      success: Boolean(state.successMessage),
    };

    return (
      <div className="container mt-4">
        <h2 className="h5">GitHub handle</h2>
        <form onSubmit={handlers.onSubmit} noValidate>
          {FormFieldsHelper.renderSubmitError(alertState)}
          {FormFieldsHelper.renderSuccess(alertState, state.successMessage)}
          {renderInput(state, disabled, handlers.onChange)}
          <button type="submit" className="btn btn-primary" disabled={disabled}>Save</button>
        </form>
      </div>
    );
  },
};

export default GithubHandleHelper;
