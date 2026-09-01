const FIELDS = [
  ['password', 'password', 'New password'],
  ['passwordConfirmation', 'password', 'Confirm new password'],
];

/**
 * Rendering helper for the reset-password page.
 */
export default class ResetPasswordHelper {
  /**
   * Render the reset-password page: the new-password form, or, once the reset has succeeded, a
   * confirmation message with a manual link back to `#/login`.
   *
   * @param {{password: string, passwordConfirmation: string, fieldErrors: object,
   *   submitError: (string|null), resetDone: boolean}} state - Page state.
   * @param {{onSubmit: Function, onPasswordChange: Function,
   *   onPasswordConfirmationChange: Function}} handlers - Event handlers.
   * @returns {React.ReactElement} The rendered reset-password page.
   */
  static render(state, handlers) {
    return (
      <div className="container mt-4">
        <h1>Reset password</h1>
        {state.resetDone
          ? ResetPasswordHelper.#renderConfirmation()
          : ResetPasswordHelper.#renderForm(state, handlers)}
      </div>
    );
  }

  /**
   * Render the new-password form.
   *
   * @param {{password: string, passwordConfirmation: string, fieldErrors: object,
   *   submitError: (string|null)}} state - Page state.
   * @param {{onSubmit: Function, onPasswordChange: Function,
   *   onPasswordConfirmationChange: Function}} handlers - Event handlers.
   * @returns {React.ReactElement} The rendered form.
   */
  static #renderForm(state, handlers) {
    const onChangeByField = {
      password: handlers.onPasswordChange,
      passwordConfirmation: handlers.onPasswordConfirmationChange,
    };

    return (
      <form onSubmit={handlers.onSubmit} noValidate>
        {ResetPasswordHelper.#renderSubmitError(state)}
        {FIELDS.map(
          ([name, type, label]) => ResetPasswordHelper.#renderField(
            name, type, label, state, onChangeByField[name],
          ),
        )}
        <button type="submit" className="btn btn-primary">Reset password</button>
      </form>
    );
  }

  /**
   * Render the submit-time error alert, if any.
   *
   * @param {{submitError: (string|null)}} state - Page state.
   * @returns {React.ReactElement|null} The error alert, or `null` when there is none.
   */
  static #renderSubmitError(state) {
    if (!state.submitError) {
      return null;
    }

    return <div className="alert alert-danger">{state.submitError}</div>;
  }

  /**
   * Render a single labeled form field, with its inline validation error, if any.
   *
   * @param {string} name - Field name, matching a key of `state` and `state.fieldErrors`.
   * @param {string} type - HTML input type.
   * @param {string} label - Field label text.
   * @param {object} state - Page state, holding the field's current value and errors.
   * @param {Function} onChange - Change handler for the field.
   * @returns {React.ReactElement} The rendered field.
   */
  static #renderField(name, type, label, state, onChange) {
    const error = state.fieldErrors[name];
    const inputId = `reset-password-${name}`;

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
   * Render the success confirmation shown after a successful reset, with a manual link back to
   * `#/login` — no auto-redirect, per the issue's decision that the user re-authenticates
   * deliberately with their new password.
   *
   * @returns {React.ReactElement} The rendered confirmation message.
   */
  static #renderConfirmation() {
    return (
      <div>
        <p>Your password has been reset.</p>
        <a href="#/login">Back to login</a>
      </div>
    );
  }
}
