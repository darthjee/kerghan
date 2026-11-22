import IssuesClient from '../../../../../client/IssuesClient.js';
import HashLocation from '../../../../../utils/routing/hashLocation.js';
import ListQuery from '../../../projects/listQuery.js';
import ProjectPaths from '../../../projects/paths.js';

/** Delay between the last search keystroke and the reload, in milliseconds. */
export const SEARCH_DEBOUNCE_MS = 300;

/** Rows per page. */
export const PER_PAGE = 50;

/** The allowed `state` filters; the first one is the default. */
export const ISSUE_STATES = ['open', 'closed', 'all'];

const LOAD_ERROR = 'Could not load the issues.';
const OPTIONS = { states: ISSUE_STATES };

/**
 * Controller for a project's issue list: keeps the query in the hash (`state`, `search`,
 * `page`), loads the page, and ignores answers that arrive out of order (P2).
 *
 * @description Every method reaching {@link IssuesClient} treats an `undefined` result
 * (session expired, the login modal is already open) by returning without touching state.
 */
export default class IssuesController {
  /**
   * Create an issue-list controller.
   *
   * @param {{setListing: Function, setQuery: Function, setLoadState: Function}} setters -
   *   React state setters: the `{issues, pagination}` listing, the `{state, page, search}`
   *   query and the `{loading, error}` load state.
   * @param {string} projectId - The project's uuid.
   * @param {typeof IssuesClient} [client] - Issues HTTP client override, for testability.
   * @param {typeof HashLocation} [location] - Hash reader/writer override, for testability.
   */
  constructor(setters, projectId, client = IssuesClient, location = HashLocation) {
    Object.assign(this, setters);
    this.projectId = projectId;
    this.client = client;
    this.location = location;
    this.query = { state: ISSUE_STATES[0], page: 1, search: '' };
    this.requestId = 0;
    this.searchTimer = null;
    this.disposed = false;
  }

  /**
   * Start the list: read the query from the hash (normalizing it) and load the first page.
   *
   * @returns {Promise<void>} Resolves once the load finishes.
   */
  async start() {
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
    const parsed = ListQuery.parse(hash, OPTIONS);
    const same = ['state', 'page', 'search'].every((key) => parsed[key] === this.query[key]);

    if (!this.#isListHash(hash) || same) {
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
    const { state, search, page } = this.query;

    try {
      const data = await this.client.list(this.projectId, {
        state, search, page, perPage: PER_PAGE,
      });

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
   * Change the state filter, going back to the first page, and reload.
   *
   * @param {string} state - `open`, `closed` or `all`; anything else becomes the default.
   * @returns {Promise<void>} Resolves once the reload finishes.
   */
  async changeState(state) {
    clearTimeout(this.searchTimer);
    this.#moveTo({ state: ISSUE_STATES.includes(state) ? state : ISSUE_STATES[0], page: 1 }, 'push');
    return this.load();
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

    this.query = ListQuery.parse(hash, OPTIONS);
    this.setQuery(this.query);

    const normalized = ProjectPaths.issues(this.projectId, this.query);

    if (this.#isListHash(hash) && hash !== normalized) {
      this.location.replace(normalized);
    }

    return this.load();
  }

  #isListHash(hash) {
    return hash.split('?')[0].replace(/\/$/, '') === ProjectPaths.show(this.projectId);
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

    this.setListing({ issues: data.issues, pagination: data.pagination });
    this.setLoadState({ loading: false, error: null });
  }

  #moveTo(changes, mode) {
    this.query = { ...this.query, ...changes };
    this.setQuery(this.query);
    this.location[mode](ProjectPaths.issues(this.projectId, this.query));
  }

  #jumpTarget({ issues, pagination }) {
    if (issues.length > 0 || this.query.page <= 1) {
      return null;
    }

    const target = Math.max(1, pagination.totalPages);

    return target === this.query.page ? null : target;
  }
}
