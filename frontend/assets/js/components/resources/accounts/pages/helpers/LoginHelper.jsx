const FIELDS = [
  ['username', 'text', 'Username'],
  ['password', 'password', 'Password'],
];

/**
 * Rendering helper for the login page.
 */
export default class LoginHelper {
  /**
   * Render the login page form.
   *
   * @param {{username: string, password: string, submitError: (string|null)}} state - Page
   *   state.
   * @param {{onSubmit: Function, onUsernameChange: Function, onPasswordChange: Function}}
   *   handlers - Event handlers.
   * @returns {React.ReactElement} The rendered login page.
   */
  static render(state, handlers) {
    const onChangeByField = {
      username: handlers.onUsernameChange,
      password: handlers.onPasswordChange,
    };

    return (
      <div className="container mt-4">
        <h1>Login</h1>
        <form onSubmit={handlers.onSubmit} noValidate>
          {LoginHelper.#renderSubmitError(state)}
          {FIELDS.map(
            ([name, type, label]) => LoginHelper.#renderField(
              name, type, label, state, onChangeByField[name],
            ),
          )}
          <button type="submit" className="btn btn-primary">Login</button>
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
   * Render a single labeled form field.
   *
   * @param {string} name - Field name, matching a key of `state`.
   * @param {string} type - HTML input type.
   * @param {string} label - Field label text.
   * @param {object} state - Page state, holding the field's current value.
   * @param {Function} onChange - Change handler for the field.
   * @returns {React.ReactElement} The rendered field.
   */
  static #renderField(name, type, label, state, onChange) {
    const inputId = `login-${name}`;

    return (
      <div className="mb-3" key={name}>
        <label className="form-label" htmlFor={inputId}>{label}</label>
        <input
          id={inputId}
          type={type}
          className="form-control"
          value={state[name]}
          onChange={onChange}
        />
      </div>
    );
  }
}
