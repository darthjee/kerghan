import AdminClient from '../../../../../client/AdminClient.js';

const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const MIN_PASSWORD_LENGTH = 8;

/**
 * Controller for the Admin User Edit page: lets an admin update a target user's username,
 * email, and/or password, with no current-password check (admin-only, ungated, matching #88's
 * self-service plumbing minus that gate). Client-side validation never sends a
 * `newPasswordConfirmation` field to the backend; the match check happens here only. Treats a
 * `403` `ApiError` the same way `AdminUsersController` does: redirect home, the fallback for
 * this page being reached directly by hash despite the current session not being an admin.
 */
export default class AdminUserEditController {
  /**
   * Create an Admin User Edit controller.
   *
   * @param {Function} setFields - React state setter for the form's field values, used on a
   *   successful save to reflect the backend's authoritative username/email back into the form
   *   and clear the password fields.
   * @param {Function} setFieldErrors - React state setter for per-field validation errors.
   * @param {Function} setSubmitError - React state setter for the submit-time error message.
   * @param {Function} setSuccess - React state setter for the success confirmation flag.
   * @param {typeof AdminClient} [client] - Admin HTTP client override, for testability.
   */
  constructor(setFields, setFieldErrors, setSubmitError, setSuccess, client = AdminClient) {
    this.setFields = setFields;
    this.setFieldErrors = setFieldErrors;
    this.setSubmitError = setSubmitError;
    this.setSuccess = setSuccess;
    this.client = client;
  }

  /**
   * Validate and submit the Admin User Edit form for the given target user. Sets inline field
   * errors and skips the API call when validation fails, same as when no field was actually
   * filled in to update; on a clean form with at least one change, submits only the fields the
   * user filled in and either reflects the response's username/email back into the form and
   * clears the password fields on success, or sets a submit-error message on failure.
   *
   * @param {number} userId - The target user's numeric id, from the route param.
   * @param {{username: string, email: string, newPassword: string,
   *   newPasswordConfirmation: string}} fields - Current form field values.
   * @returns {Promise<void>} Resolves once submission handling finishes.
   */
  async handleSubmit(userId, fields) {
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
      const result = await this.client.editUser(userId, payload);

      if (!result) {
        return;
      }

      this.#applySuccess(result);
    } catch (error) {
      this.#handleSubmitError(error);
    }
  }

  /**
   * Validate the Admin User Edit form fields: a non-blank email must be well-formed, and a
   * non-blank new password must meet the backend's minimum length and match its confirmation.
   *
   * @param {{email: string, newPassword: string, newPasswordConfirmation: string}} fields -
   *   Current form field values.
   * @returns {object} A map of field name to error message, empty when the form is valid.
   */
  validate({ email, newPassword, newPasswordConfirmation }) {
    return {
      ...this.#validateEmail(email),
      ...this.#validateNewPassword(newPassword, newPasswordConfirmation),
    };
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
   * Build the request body: `username`, `email`, and `newPassword` only when the user actually
   * filled them in — never a `newPasswordConfirmation` field.
   *
   * @param {{username: string, email: string, newPassword: string}} fields - Current form field
   *   values.
   * @returns {object} The request body for {@link AdminClient.editUser}.
   */
  #buildPayload({ username, email, newPassword }) {
    return {
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
   * form, clear the new-password fields (never keep a submitted password around), and flag the
   * success confirmation.
   *
   * @param {{user: {username: string, email: string}}} result - The backend's response body.
   * @returns {void} Nothing.
   */
  #applySuccess({ user }) {
    this.setFields((current) => ({
      ...current,
      username: user.username,
      email: user.email,
      newPassword: '',
      newPasswordConfirmation: '',
    }));
    this.setSuccess(true);
  }

  #handleSubmitError(error) {
    if (this.#redirectIfForbidden(error)) {
      return;
    }

    this.setSubmitError(error.message);
  }

  #redirectIfForbidden(error) {
    if (error.status !== 403) {
      return false;
    }

    this.#redirectHome();
    return true;
  }

  #redirectHome() {
    if (typeof window === 'undefined') {
      return;
    }

    window.location.hash = '/';
  }
}
