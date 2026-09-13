const PROFILE_FIELDS = [
  ['username', 'text', 'Username (leave blank to keep current)'],
  ['email', 'email', 'Email (leave blank to keep current)'],
];

const PASSWORD_FIELDS = [
  ['newPassword', 'password', 'New password'],
  ['newPasswordConfirmation', 'password', 'Confirm new password'],
];

/**
 * Rendering helper for the "My account" page.
 */
export default class MyAccountHelper {
  /**
   * Render the My Account page: editable username/email fields, the required current-password
   * confirmation, a change-password section, a save action, and inline error/success display.
   *
   * @param {{username: string, email: string, currentPassword: string, newPassword: string,
   *   newPasswordConfirmation: string, fieldErrors: object, submitError: (string|null),
   *   success: boolean}} state - Page state.
   * @param {{onSubmit: Function, onChange: Function}} handlers - Event handlers.
   * @returns {React.ReactElement} The rendered My Account page.
   */
  static render(state, handlers) {
    return (
      <div className="container mt-4">
        <h1>My Account</h1>
        <form onSubmit={handlers.onSubmit} noValidate>
          {MyAccountHelper.#renderSubmitError(state)}
          {MyAccountHelper.#renderSuccess(state)}
          {PROFILE_FIELDS.map(
            ([name, type, label]) => MyAccountHelper.#renderField(name, type, label, state, handlers),
          )}
          <hr />
          <h2 className="h5">Change password</h2>
          {MyAccountHelper.#renderField('currentPassword', 'password', 'Current password', state, handlers)}
          {PASSWORD_FIELDS.map(
            ([name, type, label]) => MyAccountHelper.#renderField(name, type, label, state, handlers),
          )}
          <button type="submit" className="btn btn-primary">Save</button>
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
   * Render the success confirmation alert, if the last save succeeded.
   *
   * @param {{success: boolean}} state - Page state.
   * @returns {React.ReactElement|null} The success alert, or `null` when there is none.
   */
  static #renderSuccess(state) {
    if (!state.success) {
      return null;
    }

    return <div className="alert alert-success">Account updated.</div>;
  }

  /**
   * Render a single labeled form field, with its inline validation error, if any.
   *
   * @param {string} name - Field name, matching a key of `state` and `state.fieldErrors`.
   * @param {string} type - HTML input type.
   * @param {string} label - Field label text.
   * @param {object} state - Page state, holding the field's current value and errors.
   * @param {{onChange: Function}} handlers - Event handlers.
   * @returns {React.ReactElement} The rendered field.
   */
  static #renderField(name, type, label, state, handlers) {
    const error = (state.fieldErrors ?? {})[name];
    const inputId = `my-account-${name}`;

    return (
      <div className="mb-3" key={name}>
        <label className="form-label" htmlFor={inputId}>{label}</label>
        <input
          id={inputId}
          type={type}
          className={`form-control${error ? ' is-invalid' : ''}`}
          value={state[name]}
          onChange={handlers.onChange(name)}
        />
        {error && <div className="invalid-feedback">{error}</div>}
      </div>
    );
  }
}
