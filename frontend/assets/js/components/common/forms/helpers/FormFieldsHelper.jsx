/**
 * Shared rendering helper for the small form pieces repeated across the account-edit pages and
 * the login modal: a labeled field with its inline validation error, the submit-time error
 * alert, and the success confirmation alert.
 */
// eslint-disable-next-line @typescript-eslint/no-extraneous-class -- static-methods-only
// utility/client class is this codebase's deliberate convention, matching
// components/common/loginModal/helpers/LoginModalHelper.jsx.
export default class FormFieldsHelper {
  /**
   * Render a single labeled form field, with its inline validation error, if any.
   *
   * @param {string} name - Field name, matching a key of `state` and `state.fieldErrors`.
   * @param {string} type - HTML input type.
   * @param {string} label - Field label text.
   * @param {object} state - Form state, holding the field's current value and errors.
   * @param {Function} onChange - Change handler for the field.
   * @param {string} idPrefix - Prefix for the input id; the id is `${idPrefix}${name}`.
   * @returns {React.ReactElement} The rendered field.
   */
  static renderField(name, type, label, state, onChange, idPrefix) {
    const error = (state.fieldErrors ?? {})[name];
    const inputId = `${idPrefix}${name}`;

    return (
      <div className="mb-3" key={name}>
        <label className="form-label" htmlFor={inputId}>{label}</label>
        <input
          id={inputId}
          type={type}
          className={`form-control${error ? ' is-invalid' : ''}`}
          value={state[name]}
          onChange={onChange}
        />
        {error && <div className="invalid-feedback">{error}</div>}
      </div>
    );
  }

  /**
   * Render the submit-time error alert, if any.
   *
   * @param {{submitError: (string|null)}} state - Form state.
   * @returns {React.ReactElement|null} The error alert, or `null` when there is none.
   */
  static renderSubmitError(state) {
    if (!state.submitError) {
      return null;
    }

    return <div className="alert alert-danger">{state.submitError}</div>;
  }

  /**
   * Render the success confirmation alert, if the last save succeeded.
   *
   * @param {{success: boolean}} state - Form state.
   * @param {string} message - The confirmation text to display.
   * @returns {React.ReactElement|null} The success alert, or `null` when there is none.
   */
  static renderSuccess(state, message) {
    if (!state.success) {
      return null;
    }

    return <div className="alert alert-success">{message}</div>;
  }
}
