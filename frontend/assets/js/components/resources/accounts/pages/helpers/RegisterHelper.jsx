const FIELDS = [
  ['username', 'text', 'Username'],
  ['email', 'email', 'Email'],
  ['password', 'password', 'Password'],
  ['passwordConfirmation', 'password', 'Confirm password'],
];

/**
 * Rendering helper for the register page.
 */
export default class RegisterHelper {
  /**
   * Render the register page form.
   *
   * @param {{username: string, email: string, password: string, passwordConfirmation: string,
   *   fieldErrors: object, submitError: (string|null)}} state - Page state.
   * @param {{onSubmit: Function, onUsernameChange: Function, onEmailChange: Function,
   *   onPasswordChange: Function, onPasswordConfirmationChange: Function}} handlers - Event
   *   handlers.
   * @returns {React.ReactElement} The rendered register page.
   */
  static render(state, handlers) {
    const onChangeByField = {
      username: handlers.onUsernameChange,
      email: handlers.onEmailChange,
      password: handlers.onPasswordChange,
      passwordConfirmation: handlers.onPasswordConfirmationChange,
    };

    return (
      <div className="container mt-4">
        <h1>Register</h1>
        <form onSubmit={handlers.onSubmit} noValidate>
          {RegisterHelper.#renderSubmitError(state)}
          {FIELDS.map(
            ([name, type, label]) => RegisterHelper.#renderField(
              name, type, label, state, onChangeByField[name],
            ),
          )}
          <button type="submit" className="btn btn-primary">Register</button>
        </form>
      </div>
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
    const inputId = `register-${name}`;

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
}
