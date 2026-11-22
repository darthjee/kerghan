import RepositoriesClient from '../../../../client/RepositoriesClient.js';
import ListQuery from '../listQuery.js';

/** Delay between the last keystroke and the search, in milliseconds. */
export const PICKER_DEBOUNCE_MS = 300;

/** How many added repositories one search shows. */
export const PICKER_PER_PAGE = 20;

const LOAD_ERROR = 'Could not load your repositories.';

/**
 * Controller of the repository picker: a debounced search over the caller's **added**
 * repositories (`filter: 'added'`), ignoring answers that arrive out of order (P2).
 *
 * @description The unsearched call also tells whether the user has no added repository at all
 * (`pagination.total === 0`), which the picker turns into its "Add a repository first" hint.
 * An `undefined` answer (session expired, the login modal is open) leaves the state untouched.
 */
export default class RepositoryPickerController {
  /**
   * Create the controller.
   *
   * @param {{setSearch: Function, setResults: Function, setNoneAdded: Function,
   *   setError: Function}} setters - React state setters: the typed search, the found
   *   repositories, whether the user has no added repository, and the load error.
   * @param {typeof RepositoriesClient} [client] - Repositories HTTP client override, for
   *   testability.
   */
  constructor(setters, client = RepositoriesClient) {
    Object.assign(this, setters);
    this.client = client;
    this.requestId = 0;
    this.timer = null;
    this.disposed = false;
  }

  /**
   * Load the unsearched list (and decide the "none added" hint).
   *
   * @returns {Promise<void>} Resolves once the load finishes.
   */
  async start() {
    return this.#search('');
  }

  /**
   * Change the search text; the search runs after the debounce.
   *
   * @param {string} text - The typed text, truncated to the API's limit.
   * @returns {void} Nothing.
   */
  changeSearch(text) {
    const search = ListQuery.truncateSearch(text);

    this.setSearch(search);
    clearTimeout(this.timer);
    this.timer = setTimeout(() => this.#search(search), PICKER_DEBOUNCE_MS);
  }

  /**
   * Stop the timer and ignore any answer still in flight (unmount).
   *
   * @returns {void} Nothing.
   */
  dispose() {
    this.disposed = true;
    clearTimeout(this.timer);
  }

  async #search(search) {
    this.requestId += 1;
    const requestId = this.requestId;

    try {
      const data = await this.client.list({ filter: 'added', search, perPage: PICKER_PER_PAGE });

      if (data && !this.disposed && requestId === this.requestId) {
        this.#adopt(data, search);
      }
    } catch (error) {
      if (!this.disposed && requestId === this.requestId) {
        this.setError(error?.message || LOAD_ERROR);
      }
    }
  }

  #adopt(data, search) {
    this.setResults(data.repositories);
    this.setError(null);

    if (search === '') {
      this.setNoneAdded(data.pagination.total === 0);
    }
  }
}
