import Modal from 'react-bootstrap/cjs/Modal.js';
import LoginModalFormsHelper from './LoginModalFormsHelper.jsx';

const TITLES = {
  password: 'Log in',
  register: 'Create an account',
  recover: 'Recover password',
  resetPassword: 'Set a new password',
  device: 'Authorize with logged device',
};

/**
 * Rendering helper for the login modal shell: a `react-bootstrap` `Modal` whose body is the
 * mode selector plus the active mode's sub-form (delegated to {@link LoginModalFormsHelper}).
 * Follows the same static-class-with-`#render*`-methods convention as `LoginHelper` /
 * `HeaderHelper`.
 */
export default class LoginModalHelper {
  /**
   * Render the login modal. Renders nothing visible while `state.open` is false.
   *
   * @param {{open: boolean, mode: string, username: string, email: string, password: string,
   *   passwordConfirmation: string, fieldErrors: object, submitError: (string|null),
   *   resultPanel: (string|null)}} state - Modal state.
   * @param {{onClose: Function, onSelectMode: Function, onSubmit: Function,
   *   onUsernameChange: Function, onEmailChange: Function, onPasswordChange: Function,
   *   onPasswordConfirmationChange: Function}} handlers - Event handlers.
   * @returns {React.ReactElement} The rendered modal.
   */
  static render(state, handlers) {
    return (
      <Modal show={state.open} onHide={handlers.onClose}>
        <Modal.Header closeButton>
          <Modal.Title>{LoginModalHelper.#title(state.mode)}</Modal.Title>
        </Modal.Header>
        <Modal.Body>
          {LoginModalFormsHelper.render(state, handlers)}
        </Modal.Body>
      </Modal>
    );
  }

  /**
   * Resolve the modal title for the active mode.
   *
   * @param {string} mode - The active mode (`'password'`, `'register'`, `'recover'`,
   *   `'resetPassword'`, or `'device'`).
   * @returns {string} The title text.
   */
  static #title(mode) {
    return TITLES[mode] ?? TITLES.password;
  }
}
