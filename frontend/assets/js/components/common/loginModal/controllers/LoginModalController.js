import AccountsClient from '../../../../client/AccountsClient.js';
import AuthEvents from '../../../../client/AuthEvents.js';
import LoginModalEvents from '../../../../client/LoginModalEvents.js';
import RegisterController from '../../../resources/accounts/pages/controllers/RegisterController.js';
import ResetPasswordController from '../../../resources/accounts/pages/controllers/ResetPasswordController.js';

/** Every field any mode can hold; switching modes resets to exactly this. */
const INITIAL_FIELDS = {
  username: '', email: '', password: '', passwordConfirmation: '',
};

/** The modes the modal can be in. */
const MODES = {
  password: 'password',
  register: 'register',
  recover: 'recover',
  resetPassword: 'resetPassword',
};

const noop = () => undefined;

// `RegisterController.validate` is a pure method that never touches the instance's setters or
// client, so a single shared instance is enough to reuse its rules without duplicating them.
const registerValidator = new RegisterController(noop, noop);

// `ResetPasswordController.validate` is a pure method that never touches the instance's setters
// or client, so a single shared instance is enough to reuse its rules without duplicating them.
const resetPasswordValidator = new ResetPasswordController(noop, noop, noop);

/**
 * Controller for the login modal: owns mode state and per-mode submission. Password mode
 * authenticates via {@link AccountsClient.login}; Register mode validates with
 * {@link RegisterController}'s rules then calls {@link AccountsClient.register} — both converge
 * on the shared success handler that closes the modal and redirects home. Recover mode calls
 * {@link AccountsClient.recover} and always shows the neutral "check your email" panel;
 * Set-new-password mode validates with {@link ResetPasswordController}'s rules then calls
 * {@link AccountsClient.resetPassword} and shows a success panel — neither closes the modal,
 * emits auth state, nor redirects.
 */
export default class LoginModalController {
  /**
   * Create a login-modal controller.
   *
   * @param {Function} setMode - React state setter for the active mode.
   * @param {Function} setFields - React state setter for the form field values.
   * @param {Function} setFieldErrors - React state setter for per-field validation errors.
   * @param {Function} setSubmitError - React state setter for the submit-time error message.
   * @param {Function} setResultPanel - React state setter for the shown result panel
   *   (`'recover'`, `'resetPassword'`, or `null`).
   * @param {typeof AccountsClient} [client] - Accounts HTTP client override, for testability.
   */
  constructor(
    setMode, setFields, setFieldErrors, setSubmitError, setResultPanel, client = AccountsClient,
  ) {
    this.setMode = setMode;
    this.setFields = setFields;
    this.setFieldErrors = setFieldErrors;
    this.setSubmitError = setSubmitError;
    this.setResultPanel = setResultPanel;
    this.client = client;
  }

  /**
   * Switch the modal between modes, resetting every form field, clearing all errors, and
   * dropping any shown result panel — no field values carry over between modes.
   *
   * @param {string} mode - The mode to switch to (`'password'`, `'register'`, `'recover'`, or
   *   `'resetPassword'`).
   * @returns {void} Nothing.
   */
  switchMode(mode) {
    this.setMode(mode);
    this.setFields({ ...INITIAL_FIELDS });
    this.setFieldErrors({});
    this.setSubmitError(null);
    this.setResultPanel(null);
  }

  /**
   * Submit the modal form for the active mode.
   *
   * @param {string} mode - The active mode (`'password'`, `'register'`, `'recover'`, or
   *   `'resetPassword'`).
   * @param {object} fields - Current form field values.
   * @param {string} resetToken - The recovery token, used only by Set-new-password mode.
   * @returns {Promise<void>} Resolves once submission handling finishes.
   */
  handleSubmit(mode, fields, resetToken) {
    const handlers = {
      [MODES.register]: () => this.#submitRegister(fields),
      [MODES.recover]: () => this.#submitRecover(fields),
      [MODES.resetPassword]: () => this.#submitResetPassword(fields, resetToken),
    };

    return (handlers[mode] ?? (() => this.#submitPassword(fields)))();
  }

  /**
   * Password-mode submit: authenticate against the backend, converging on the shared success
   * handler, or set a submit-error message on failure — same shape as today's `LoginController`.
   *
   * @param {{username: string, password: string}} fields - Current form field values.
   * @returns {Promise<void>} Resolves once submission handling finishes.
   */
  async #submitPassword(fields) {
    this.setSubmitError(null);

    try {
      this.#handleSuccess(await this.client.login(fields));
    } catch (error) {
      this.setSubmitError(error.message);
    }
  }

  /**
   * Register-mode submit: run the shared registration validation and skip the API call when it
   * fails; on a clean form, register (which also logs in) and converge on the shared success
   * handler, or set a submit-error message on failure — same shape as today's
   * `RegisterController`.
   *
   * @param {{username: string, email: string, password: string,
   *   passwordConfirmation: string}} fields - Current form field values.
   * @returns {Promise<void>} Resolves once submission handling finishes.
   */
  async #submitRegister(fields) {
    const errors = registerValidator.validate(fields);

    this.setFieldErrors(errors);

    if (Object.keys(errors).length > 0) {
      return;
    }

    this.setSubmitError(null);

    try {
      this.#handleSuccess(await this.client.register(fields));
    } catch (error) {
      this.setSubmitError(error.message);
    }
  }

  /**
   * Recover-mode submit: request a password recovery email, then always show the neutral
   * "check your email" panel from a `finally` block so a rejected request looks identical to a
   * successful one — the enumeration-safety contract, mirroring the old
   * `RecoverController.handleSubmit`.
   *
   * @param {{email: string}} fields - Current form field values.
   * @returns {Promise<void>} Resolves once submission handling finishes.
   */
  async #submitRecover(fields) {
    this.setSubmitError(null);

    try {
      await this.client.recover(fields.email);
    } finally {
      this.setResultPanel('recover');
    }
  }

  /**
   * Set-new-password-mode submit: run the shared reset-password validation and skip the API
   * call when it fails; on a clean form, submit the token and new password, then show the
   * success panel — never closes the modal, emits auth state, nor redirects. Sets a
   * submit-error message on failure.
   *
   * @param {{password: string, passwordConfirmation: string}} fields - Current form field
   *   values.
   * @param {string} token - The recovery token carried in from the recovery link.
   * @returns {Promise<void>} Resolves once submission handling finishes.
   */
  async #submitResetPassword(fields, token) {
    const errors = resetPasswordValidator.validate(fields);

    this.setFieldErrors(errors);

    if (Object.keys(errors).length > 0) {
      return;
    }

    this.setSubmitError(null);

    try {
      await this.client.resetPassword({ token, ...fields });
      this.setResultPanel('resetPassword');
    } catch (error) {
      this.setSubmitError(error.message);
    }
  }

  /**
   * Shared success path for Password / Register modes: the refresh token is already persisted
   * by the `AccountsClient` call, so announce the new logged-in auth state, close the modal,
   * and redirect home.
   *
   * @param {{user: {isAdmin: boolean}}} result - The successful login/register response.
   * @returns {void} Nothing.
   */
  #handleSuccess(result) {
    AuthEvents.emit(true, result.user.isAdmin);
    LoginModalEvents.close();
    this.#redirectHome();
  }

  /**
   * Navigate to the home route. SSR/spec-safe — a no-op when `window` is not defined, matching
   * `LoginController#redirectHome`.
   *
   * @returns {void} Nothing.
   */
  #redirectHome() {
    if (typeof window === 'undefined') {
      return;
    }

    window.location.hash = '/';
  }
}
