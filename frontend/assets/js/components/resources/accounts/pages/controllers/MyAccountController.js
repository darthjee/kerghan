import AccountsClient from '../../../../../client/AccountsClient.js';

const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const MIN_PASSWORD_LENGTH = 8;

/**
 * Controller for the "My account" page: lets the logged-in user update their username, email,
 * and/or password, always confirmed by their current password. There is currently no "get my
 * account" read endpoint, so the username/email fields start blank — leaving one blank means
 * "keep the current value", not "clear it" (prefilling them is a follow-up, once such a read
 * endpoint exists). Client-side validation never sends a `newPasswordConfirmation` field to the
 * backend; the match check happens here only.
 */
export default class MyAccountController {
  /**
   * Create a My Account controller.
   *
   * @param {Function} setFields - React state setter for the form's field values, used on a
   *   successful save to reflect the backend's authoritative username/email back into the form
   *   and clear the password fields.
   * @param {Function} setFieldErrors - React state setter for per-field validation errors.
   * @param {Function} setSubmitError - React state setter for the submit-time error message.
   * @param {Function} setSuccess - React state setter for the success confirmation flag.
   * @param {typeof AccountsClient} [client] - Accounts HTTP client override, for testability.
   */
  constructor(setFields, setFieldErrors, setSubmitError, setSuccess, client = AccountsClient) {
    this.setFields = setFields;
    this.setFieldErrors = setFieldErrors;
    this.setSubmitError = setSubmitError;
    this.setSuccess = setSuccess;
    this.client = client;
  }

  /**
   * Validate and submit the My Account form. Sets inline field errors and skips the API call
   * when validation fails, same as when no field was actually filled in to update; on a clean
   * form with at least one change, submits only the fields the user filled in (plus the
   * always-required current password) and either reflects the response's username/email back
   * into the form and clears the password fields on success, or sets a submit-error message on
   * failure.
   *
   * @param {{username: string, email: string, currentPassword: string, newPassword: string,
   *   newPasswordConfirmation: string}} fields - Current form field values.
   * @returns {Promise<void>} Resolves once submission handling finishes.
   */
  async handleSubmit(fields) {
    const errors = this.validate(fields);

    this.setFieldErrors(errors);
    this.setSuccess(false);

    if (Object.keys(errors).length > 0) {
      return;
    }

    const payload = this.#buildPayload(fields);

    if (!this.#hasUpdate(payload)) {
      this.setSubmitError('Provide a username, email, or new password to update.');
      return;
    }

    this.setSubmitError(null);

    try {
      const result = await this.client.updateAccount(payload);

      if (!result) {
        return;
      }

      this.#applySuccess(result);
    } catch (error) {
      this.setSubmitError(error.message);
    }
  }

  /**
   * Validate the My Account form fields: the current password is always required, a non-blank
   * email must be well-formed, and a non-blank new password must meet the backend's minimum
   * length and match its confirmation.
   *
   * @param {{email: string, currentPassword: string, newPassword: string,
   *   newPasswordConfirmation: string}} fields - Current form field values.
   * @returns {object} A map of field name to error message, empty when the form is valid.
   */
  validate({
    email, currentPassword, newPassword, newPasswordConfirmation,
  }) {
    return {
      ...this.#validateCurrentPassword(currentPassword),
      ...this.#validateEmail(email),
      ...this.#validateNewPassword(newPassword, newPasswordConfirmation),
    };
  }

  #validateCurrentPassword(currentPassword) {
    return currentPassword ? {} : { currentPassword: 'Current password is required' };
  }

  #validateEmail(email) {
    if (!email) {
      return {};
    }

    return EMAIL_PATTERN.test(email) ? {} : { email: 'Email is invalid' };
  }

  #validateNewPassword(newPassword, newPasswordConfirmation) {
    if (!newPassword) {
      return {};
    }

    if (newPassword.length < MIN_PASSWORD_LENGTH) {
      return { newPassword: `Password must be at least ${MIN_PASSWORD_LENGTH} characters` };
    }

    if (newPassword !== newPasswordConfirmation) {
      return { newPasswordConfirmation: 'Passwords do not match' };
    }

    return {};
  }

  /**
   * Build the PATCH request body: the always-required current password, plus `username`,
   * `email`, and `newPassword` only when the user actually filled them in — never a
   * `newPasswordConfirmation` field.
   *
   * @param {{username: string, email: string, currentPassword: string,
   *   newPassword: string}} fields - Current form field values.
   * @returns {object} The request body for {@link AccountsClient.updateAccount}.
   */
  #buildPayload({
    username, email, currentPassword, newPassword,
  }) {
    return {
      currentPassword,
      ...(username && { username }),
      ...(email && { email }),
      ...(newPassword && { newPassword }),
    };
  }

  #hasUpdate(payload) {
    return ('username' in payload) || ('email' in payload) || ('newPassword' in payload);
  }

  /**
   * Apply a successful save: reflect the backend's authoritative username/email back into the
   * form, clear the current/new password fields (never keep a submitted password around), and
   * flag the success confirmation.
   *
   * @param {{username: string, email: string}} result - The backend's response body.
   * @returns {void} Nothing.
   */
  #applySuccess(result) {
    this.setFields((current) => ({
      ...current,
      username: result.username,
      email: result.email,
      currentPassword: '',
      newPassword: '',
      newPasswordConfirmation: '',
    }));
    this.setSuccess(true);
  }
}
