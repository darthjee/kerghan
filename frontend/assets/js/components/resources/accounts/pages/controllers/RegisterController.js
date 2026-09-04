import AccountsClient from '../../../../../client/AccountsClient.js';
import AuthEvents from '../../../../../client/AuthEvents.js';

const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

/**
 * Controller for the register page: validates the form client-side, then submits it to
 * {@link AccountsClient} when the form is clean. Registration also logs the new account in
 * (`AccountsClient.register` persists a refresh token), so a successful submission announces the
 * new logged-in auth state via {@link AuthEvents}, same as `LoginController`.
 */
export default class RegisterController {
  /**
   * Create a register controller.
   *
   * @param {Function} setFieldErrors - React state setter for per-field validation errors.
   * @param {Function} setSubmitError - React state setter for the submit-time error message.
   * @param {typeof AccountsClient} [client] - Accounts HTTP client override, for testability.
   */
  constructor(setFieldErrors, setSubmitError, client = AccountsClient) {
    this.setFieldErrors = setFieldErrors;
    this.setSubmitError = setSubmitError;
    this.client = client;
  }

  /**
   * Validate and submit the registration form. Sets inline field errors and skips the API
   * call when validation fails; on a clean form, submits to the backend and either announces the
   * new logged-in auth state and redirects home on success, or sets a submit-error message on
   * failure.
   *
   * @param {{username: string, email: string, password: string,
   *   passwordConfirmation: string}} fields - Current form field values.
   * @returns {Promise<void>} Resolves once submission handling finishes.
   */
  async handleSubmit(fields) {
    const errors = this.validate(fields);

    this.setFieldErrors(errors);

    if (Object.keys(errors).length > 0) {
      return;
    }

    this.setSubmitError(null);

    try {
      const result = await this.client.register(fields);
      AuthEvents.emit(true, result.user.isAdmin);
      this.#redirectHome();
    } catch (error) {
      this.setSubmitError(error.message);
    }
  }

  /**
   * Validate the registration form fields.
   *
   * @param {{username: string, email: string, password: string,
   *   passwordConfirmation: string}} fields - Current form field values.
   * @returns {object} A map of field name to error message, empty when the form is valid.
   */
  validate({
    username, email, password, passwordConfirmation,
  }) {
    return {
      ...this.#validateUsername(username),
      ...this.#validateEmail(email),
      ...this.#validatePassword(password),
      ...this.#validatePasswordConfirmation(password, passwordConfirmation),
    };
  }

  #validateUsername(username) {
    return username ? {} : { username: 'Username is required' };
  }

  #validateEmail(email) {
    if (!email) {
      return { email: 'Email is required' };
    }

    return EMAIL_PATTERN.test(email) ? {} : { email: 'Email is invalid' };
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

  #redirectHome() {
    if (typeof window === 'undefined') {
      return;
    }

    window.location.hash = '/';
  }
}
