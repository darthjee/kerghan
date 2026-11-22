import ProjectsClient from '../../../../../../client/ProjectsClient.js';
import HashLocation from '../../../../../../utils/routing/hashLocation.js';
import ListQuery from '../../../listQuery.js';
import ProjectNoticeStore from '../../../ProjectNoticeStore.js';

/** Delay between the last search keystroke and the reload, in milliseconds. */
export const SEARCH_DEBOUNCE_MS = 300;

/** The path of the project list. */
export const LIST_PATH = '/projects';

const LOAD_ERROR = 'Could not load your projects.';

/**
 * Controller for the project list: keeps the query in the hash (`search`, `page`), loads the
 * page, and ignores answers that arrive out of order.
 *
 * @description Every method reaching {@link ProjectsClient} treats an `undefined` result
 * (session expired, the login modal is already open) by returning without touching state.
 */
export default class ProjectsController {
  /**
   * Create a project-list controller.
   *
   * @param {{setListing: Function, setQuery: Function, setLoadState: Function,
   *   setNotice: Function}} setters - React state setters: the `{projects, pagination}`
   *   listing, the `{page, search}` query, the `{loading, error}` load state and the one-time
   *   notice lines.
   * @param {typeof ProjectsClient} [client] - Projects HTTP client override, for testability.
   * @param {typeof HashLocation} [location] - Hash reader/writer override, for testability.
   */
  constructor(setters, client = ProjectsClient, location = HashLocation) {
    Object.assign(this, setters);
    this.client = client;
    this.location = location;
    this.query = { page: 1, search: '' };
    this.requestId = 0;
    this.searchTimer = null;
    this.disposed = false;
  }

  /**
   * Start the page: read the query from the hash (normalizing it), show the one-time notice
   * left by a deletion, and load the first page.
   *
   * @returns {Promise<void>} Resolves once the load finishes.
   */
  async start() {
    this.setNotice(ProjectNoticeStore.take());
    return this.#adoptHash();
  }

  /**
   * React to a `hashchange` (Back, Forward or a link): when the query in the hash differs from
   * the one shown, adopt it and reload.
   *
   * @returns {Promise<void>} Resolves once the reload finishes (or at once when nothing
   *   changed, or when the hash already left the list).
   */
  async handleHashChange() {
    const hash = this.location.read();
    const parsed = ListQuery.parse(hash);

    if (!ProjectsController.#isListHash(hash)) {
      return undefined;
    }

    if (parsed.page === this.query.page && parsed.search === this.query.search) {
      return undefined;
    }

    return this.#adoptHash();
  }

  /**
   * Load the current query's page. A page past the end, or one left empty, jumps once to the
   * last non-empty page, or to page 1 when there are no rows (U5).
   *
   * @param {boolean} [jumped] - Whether this load already is the jump.
   * @returns {Promise<void>} Resolves once the load finishes.
   */
  async load(jumped = false) {
    this.requestId += 1;
    const requestId = this.requestId;

    try {
      const data = await this.client.list(this.query);

      if (data && this.#isCurrent(requestId)) {
        await this.#adopt(data, jumped);
      }
    } catch (error) {
      if (this.#isCurrent(requestId)) {
        this.setLoadState({ loading: false, error: error?.message || LOAD_ERROR });
      }
    }
  }

  /**
   * Retry a failed load, showing the loading state again meanwhile.
   *
   * @returns {Promise<void>} Resolves once the load finishes.
   */
  async retry() {
    this.setLoadState({ loading: true, error: null });
    return this.load();
  }

  /**
   * Change the search text, going back to the first page; the reload is debounced.
   *
   * @param {string} search - The typed text, truncated to the API's limit.
   * @returns {void} Nothing.
   */
  changeSearch(search) {
    this.#moveTo({ search: ListQuery.truncateSearch(search), page: 1 }, 'replace');
    clearTimeout(this.searchTimer);
    this.searchTimer = setTimeout(() => this.load(), SEARCH_DEBOUNCE_MS);
  }

  /**
   * Change the page and reload.
   *
   * @param {number} page - The page to show.
   * @returns {Promise<void>} Resolves once the reload finishes.
   */
  async changePage(page) {
    clearTimeout(this.searchTimer);
    this.#moveTo({ page }, 'push');
    return this.load();
  }

  /**
   * Stop every timer and ignore any answer still in flight (unmount).
   *
   * @returns {void} Nothing.
   */
  dispose() {
    this.disposed = true;
    clearTimeout(this.searchTimer);
  }

  async #adoptHash() {
    const hash = this.location.read();

    this.query = ListQuery.parse(hash);
    this.setQuery(this.query);

    const normalized = ListQuery.toHash(LIST_PATH, this.query);

    if (ProjectsController.#isListHash(hash) && hash !== normalized) {
      this.location.replace(normalized);
    }

    return this.load();
  }

  static #isListHash(hash) {
    return hash.split('?')[0].replace(/\/$/, '') === `#${LIST_PATH}`;
  }

  #isCurrent(requestId) {
    return !this.disposed && requestId === this.requestId;
  }

  async #adopt(data, jumped) {
    const target = this.#jumpTarget(data);

    if (!jumped && target !== null) {
      this.#moveTo({ page: target }, 'replace');
      await this.load(true);
      return;
    }

    this.setListing({ projects: data.projects, pagination: data.pagination });
    this.setLoadState({ loading: false, error: null });
  }

  #moveTo(changes, mode) {
    this.query = { ...this.query, ...changes };
    this.setQuery(this.query);
    this.location[mode](ListQuery.toHash(LIST_PATH, this.query));
  }

  #jumpTarget({ projects, pagination }) {
    if (projects.length > 0 || this.query.page <= 1) {
      return null;
    }

    const target = Math.max(1, pagination.totalPages);

    return target === this.query.page ? null : target;
  }
}
