import AccountsClient from '../../../../../client/AccountsClient.js';
import { isValidGithubHandle } from '../../../../../utils/validation/fieldValidators.js';

export const LOAD_ERROR = 'Could not load your GitHub handle.';
export const FIELD_ERROR = 'Use letters, digits and single hyphens (max 39 characters).';
export const UPDATED_MESSAGE = 'GitHub handle updated.';
export const REMOVED_MESSAGE = 'GitHub handle removed.';

/** Initial state of the GitHub handle section. */
export const INITIAL_STATE = {
  handle: '',
  loading: true,
  loadError: null,
  fieldError: null,
  submitError: null,
  successMessage: null,
  saving: false,
};

/**
 * Controller for the "GitHub handle" section of the account page. Self-contained: it never
 * touches the username / email / password form's state.
 */
export default class GithubHandleController {
  /**
   * Create the controller.
   *
   * @param {Function} setState - React state setter for the section state; always called with an
   *   updater function that merges a patch into the current state.
   * @param {typeof AccountsClient} [client] - Accounts HTTP client override, for testability.
   */
  constructor(setState, client = AccountsClient) {
    this.setState = setState;
    this.client = client;
  }

  /**
   * Merge a patch into the section state.
   *
   * @param {object} patch - The fields to merge.
   * @returns {void} Nothing.
   */
  patch(patch) {
    this.setState((current) => ({ ...current, ...patch }));
  }

  /**
   * Load the caller's current handle. On failure the section keeps a load error and stays
   * disabled.
   *
   * @returns {Promise<void>} Resolves once the load finishes.
   */
  async load() {
    this.patch({ loading: true, loadError: null });

    try {
      const account = await this.client.getMyAccount();

      this.patch({ handle: account?.githubHandle ?? '', loading: false });
    } catch {
      this.patch({ loading: false, loadError: LOAD_ERROR });
    }
  }

  /**
   * Validate and save the handle. An empty value clears it; otherwise the trimmed value is sent
   * (the server normalises it).
   *
   * @param {string} rawValue - The input value.
   * @returns {Promise<void>} Resolves once the save finishes.
   */
  async save(rawValue) {
    const trimmed = rawValue.trim();

    if (trimmed !== '' && !isValidGithubHandle(trimmed)) {
      this.patch({ fieldError: FIELD_ERROR, submitError: null, successMessage: null });
      return;
    }

    this.patch({
      fieldError: null, submitError: null, successMessage: null, saving: true,
    });

    try {
      const account = await this.client.updateGithubHandle(trimmed === '' ? null : trimmed);
      const handle = account?.githubHandle ?? '';

      this.patch({
        handle,
        saving: false,
        successMessage: handle === '' ? REMOVED_MESSAGE : UPDATED_MESSAGE,
      });
    } catch (error) {
      this.patch({ saving: false, submitError: error.message });
    }
  }
}
