/**
 * Client-side validation rules for the reset-password (Set-new-password) form: the new password
 * is required and its confirmation must be present and match. Kept as an instance method for
 * consistency with `RegisterController`, so {@link LoginModalController} can reuse the rules via
 * a single shared no-arg instance without duplicating them. Neither `validate` nor its helpers
 * touch any state or HTTP client.
 */
export default class ResetPasswordController {
  /**
   * Validate the reset-password form fields.
   *
   * @param {{password: string, passwordConfirmation: string}} fields - Current form field
   *   values.
   * @returns {object} A map of field name to error message, empty when the form is valid.
   */
  validate({ password, passwordConfirmation }) {
    return {
      ...this.#validatePassword(password),
      ...this.#validatePasswordConfirmation(password, passwordConfirmation),
    };
  }

  #validatePassword(password) {
    return password ? {} : { password: 'Password is required' };
  }

  #validatePasswordConfirmation(password, passwordConfirmation) {
    if (!passwordConfirmation) {
      return { passwordConfirmation: 'Password confirmation is required' };
    }

    if (password && password !== passwordConfirmation) {
      return { passwordConfirmation: 'Passwords do not match' };
    }

    return {};
  }
}
