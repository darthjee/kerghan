const FIELDS_BY_MODE = {
  password: [
    ['username', 'text', 'Username'],
    ['password', 'password', 'Password'],
  ],
  register: [
    ['username', 'text', 'Username'],
    ['email', 'email', 'Email'],
    ['password', 'password', 'Password'],
    ['passwordConfirmation', 'password', 'Confirm password'],
  ],
};

const MODE_TABS = [
  ['password', 'Password'],
  ['register', 'Register'],
];

const SUBMIT_LABELS = { password: 'Log in', register: 'Register' };

/**
 * Rendering helper for the login modal's body: the Password/Register mode selector and the
 * active mode's sub-form. Kept separate from {@link LoginModalHelper} (the `Modal` shell) so
 * its plain markup stays unit-testable without a DOM. Follows the same
 * static-class-with-`#render*`-methods convention as `LoginHelper` / `RegisterHelper`.
 */
export default class LoginModalFormsHelper {
  /**
   * Render the mode selector and the active mode's sub-form.
   *
   * @param {{mode: string, username: string, email: string, password: string,
   *   passwordConfirmation: string, fieldErrors: object, submitError: (string|null)}} state -
   *   Modal state.
   * @param {{onSelectMode: Function, onSubmit: Function, onUsernameChange: Function,
   *   onEmailChange: Function, onPasswordChange: Function,
   *   onPasswordConfirmationChange: Function}} handlers - Event handlers.
   * @returns {React.ReactElement} The rendered modal body.
   */
  static render(state, handlers) {
    return (
      <div>
        {LoginModalFormsHelper.#renderModeSelector(state, handlers)}
        {LoginModalFormsHelper.#renderForm(state, handlers)}
      </div>
    );
  }

  /**
   * Render the Password/Register mode selector, marking the active mode.
   *
   * @param {{mode: string}} state - Modal state.
   * @param {{onSelectMode: Function}} handlers - Event handlers.
   * @returns {React.ReactElement} The rendered mode selector.
   */
  static #renderModeSelector(state, handlers) {
    return (
      <div className="btn-group mb-3" role="group">
        {MODE_TABS.map(([mode, label]) => (
          <button
            key={mode}
            type="button"
            className={`btn btn-outline-primary${state.mode === mode ? ' active' : ''}`}
            onClick={() => handlers.onSelectMode(mode)}
          >
            {label}
          </button>
        ))}
      </div>
    );
  }

  /**
   * Render the active mode's sub-form: its submit-time error, its fields, and its submit
   * button.
   *
   * @param {object} state - Modal state.
   * @param {object} handlers - Event handlers.
   * @returns {React.ReactElement} The rendered sub-form.
   */
  static #renderForm(state, handlers) {
    const mode = state.mode === 'register' ? 'register' : 'password';
    const onChangeByField = {
      username: handlers.onUsernameChange,
      email: handlers.onEmailChange,
      password: handlers.onPasswordChange,
      passwordConfirmation: handlers.onPasswordConfirmationChange,
    };

    return (
      <form onSubmit={handlers.onSubmit} noValidate>
        {LoginModalFormsHelper.#renderSubmitError(state)}
        {FIELDS_BY_MODE[mode].map(([name, type, label]) => LoginModalFormsHelper.#renderField(
          name, type, label, state, onChangeByField[name],
        ))}
        <button type="submit" className="btn btn-primary">{SUBMIT_LABELS[mode]}</button>
      </form>
    );
  }

  /**
   * Render the submit-time error alert, if any.
   *
   * @param {{submitError: (string|null)}} state - Modal state.
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
   * @param {object} state - Modal state, holding the field's current value and errors.
   * @param {Function} onChange - Change handler for the field.
   * @returns {React.ReactElement} The rendered field.
   */
  static #renderField(name, type, label, state, onChange) {
    const error = (state.fieldErrors ?? {})[name];
    const inputId = `login-modal-${name}`;

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
