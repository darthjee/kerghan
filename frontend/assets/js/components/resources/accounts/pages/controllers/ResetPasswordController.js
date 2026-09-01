import AccountsClient from '../../../../../client/AccountsClient.js';

/**
 * Controller for the reset-password page: validates the new-password form client-side, then
 * submits it, together with the recovery token, to {@link AccountsClient}. Unlike
 * `LoginController`/`RegisterController`, there is no redirect on success — the user
 * re-authenticates deliberately with their new password via a manual link back to `#/login`.
 */
export default class ResetPasswordController {
  /**
   * Create a reset-password controller.
   *
   * @param {Function} setFieldErrors - React state setter for per-field validation errors.
   * @param {Function} setSubmitError - React state setter for the submit-time error message.
   * @param {Function} setResetDone - React state setter flipping the page into its success
   *   state.
   * @param {typeof AccountsClient} [client] - Accounts HTTP client override, for testability.
   */
  constructor(setFieldErrors, setSubmitError, setResetDone, client = AccountsClient) {
    this.setFieldErrors = setFieldErrors;
    this.setSubmitError = setSubmitError;
    this.setResetDone = setResetDone;
    this.client = client;
  }

  /**
   * Validate and submit the reset-password form. Sets inline field errors and skips the API
   * call when validation fails; on a clean form, submits the token and new password to the
   * backend, and either flips to the success state or sets a submit-error message on failure.
   *
   * @param {string} token - The recovery token read from the recovery link.
   * @param {{password: string, passwordConfirmation: string}} fields - Current form field
   *   values.
   * @returns {Promise<void>} Resolves once submission handling finishes.
   */
  async handleSubmit(token, fields) {
    const errors = this.validate(fields);

    this.setFieldErrors(errors);

    if (Object.keys(errors).length > 0) {
      return;
    }

    this.setSubmitError(null);

    try {
      await this.client.resetPassword({ token, ...fields });
      this.setResetDone(true);
    } catch (error) {
      this.setSubmitError(error.message);
    }
  }

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
