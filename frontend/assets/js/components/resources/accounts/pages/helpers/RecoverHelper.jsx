/**
 * Rendering helper for the recover page.
 */
export default class RecoverHelper {
  /**
   * Render the recover page: the email request form, or, once the request has been submitted,
   * a static confirmation message.
   *
   * @param {{email: string, sent: boolean}} state - Page state.
   * @param {{onSubmit: Function, onEmailChange: Function}} handlers - Event handlers.
   * @returns {React.ReactElement} The rendered recover page.
   */
  static render(state, handlers) {
    return (
      <div className="container mt-4">
        <h1>Recover</h1>
        {state.sent ? RecoverHelper.#renderConfirmation() : RecoverHelper.#renderForm(state, handlers)}
      </div>
    );
  }

  /**
   * Render the email request form.
   *
   * @param {{email: string}} state - Page state.
   * @param {{onSubmit: Function, onEmailChange: Function}} handlers - Event handlers.
   * @returns {React.ReactElement} The rendered form.
   */
  static #renderForm(state, handlers) {
    return (
      <form onSubmit={handlers.onSubmit} noValidate>
        <div className="mb-3">
          <label className="form-label" htmlFor="recover-email">Email</label>
          <input
            id="recover-email"
            type="email"
            className="form-control"
            value={state.email}
            onChange={handlers.onEmailChange}
          />
        </div>
        <button type="submit" className="btn btn-primary">Recover</button>
      </form>
    );
  }

  /**
   * Render the "check your email" confirmation message shown after submission, regardless of
   * whether the request actually succeeded (see `RecoverController`'s enumeration-safety
   * contract).
   *
   * @returns {React.ReactElement} The rendered confirmation message.
   */
  static #renderConfirmation() {
    return (
      <p>If that email matches an account, a recovery link has been sent to it.</p>
    );
  }
}
