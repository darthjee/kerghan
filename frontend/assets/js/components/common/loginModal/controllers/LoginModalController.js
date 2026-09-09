import AccountsClient from '../../../../client/AccountsClient.js';
import AuthEvents from '../../../../client/AuthEvents.js';
import LoginModalEvents from '../../../../client/LoginModalEvents.js';
import RegisterController from '../../../resources/accounts/pages/controllers/RegisterController.js';

/** Every field either mode can hold; switching modes resets to exactly this. */
const INITIAL_FIELDS = {
  username: '', email: '', password: '', passwordConfirmation: '',
};

/** The two modes the modal can be in. */
const MODES = { password: 'password', register: 'register' };

const noop = () => undefined;

// `RegisterController.validate` is a pure method that never touches the instance's setters or
// client, so a single shared instance is enough to reuse its rules without duplicating them.
const registerValidator = new RegisterController(noop, noop);

/**
 * Controller for the login modal: owns mode state, per-mode submission, and the shared
 * success path. Password mode authenticates via {@link AccountsClient.login}; Register mode
 * validates with {@link RegisterController}'s rules then calls {@link AccountsClient.register}.
 * Both modes converge on the same success handler, mirroring today's `LoginController`.
 */
export default class LoginModalController {
  /**
   * Create a login-modal controller.
   *
   * @param {Function} setMode - React state setter for the active mode.
   * @param {Function} setFields - React state setter for the form field values.
   * @param {Function} setFieldErrors - React state setter for per-field validation errors.
   * @param {Function} setSubmitError - React state setter for the submit-time error message.
   * @param {typeof AccountsClient} [client] - Accounts HTTP client override, for testability.
   */
  constructor(setMode, setFields, setFieldErrors, setSubmitError, client = AccountsClient) {
    this.setMode = setMode;
    this.setFields = setFields;
    this.setFieldErrors = setFieldErrors;
    this.setSubmitError = setSubmitError;
    this.client = client;
  }

  /**
   * Switch the modal between Password and Register mode, resetting every form field and
   * clearing all errors — no field values carry over between modes.
   *
   * @param {string} mode - The mode to switch to (`'password'` or `'register'`).
   * @returns {void} Nothing.
   */
  switchMode(mode) {
    this.setMode(mode);
    this.setFields({ ...INITIAL_FIELDS });
    this.setFieldErrors({});
    this.setSubmitError(null);
  }

  /**
   * Submit the modal form for the active mode.
   *
   * @param {string} mode - The active mode (`'password'` or `'register'`).
   * @param {object} fields - Current form field values.
   * @returns {Promise<void>} Resolves once submission handling finishes.
   */
  handleSubmit(mode, fields) {
    if (mode === MODES.register) {
      return this.#submitRegister(fields);
    }

    return this.#submitPassword(fields);
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
   * Shared success path for both modes: the refresh token is already persisted by the
   * `AccountsClient` call, so announce the new logged-in auth state, close the modal, and
   * redirect home.
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
