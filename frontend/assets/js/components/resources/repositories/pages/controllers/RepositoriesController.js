import RepositoriesClient from '../../../../../client/RepositoriesClient.js';
import AddErrorMessages from '../repositories/addErrorMessages.js';
import AddStateStore from '../repositories/AddStateStore.js';
import RefreshCountdown from '../repositories/RefreshCountdown.js';
import RepositoriesPoller from '../repositories/RepositoriesPoller.js';
import SourceKeys from '../repositories/sourceKeys.js';

/** Delay between the last search keystroke and the reload, in milliseconds. */
export const SEARCH_DEBOUNCE_MS = 300;

/** Query the page starts with. */
export const INITIAL_QUERY = Object.freeze({ page: 1, filter: 'all', search: '' });

const LOAD_ERROR = 'Could not load your repositories.';

/**
 * Parse an ISO-8601 date into epoch milliseconds.
 *
 * @param {string|null} value - The ISO-8601 date, or `null`.
 * @returns {number|null} The epoch milliseconds, or `null` when absent.
 */
function toTime(value) {
  return value ? Date.parse(value) : null;
}

/**
 * Controller for the Repositories page: loads the listing, polls the sync, refreshes, adds
 * repositories and tracks dismissed banners.
 *
 * @description Every method reaching {@link RepositoriesClient} treats an `undefined` result
 * (session expired, the login modal is already open) by returning without touching state.
 */
export default class RepositoriesController {
  /**
   * Create a Repositories controller.
   *
   * @param {{setListing: Function, setSync: Function, setQuery: Function,
   *   setLoadState: Function, setAddState: Function, setDismissed: Function,
   *   setRefreshNotice: Function, setNow: Function, setCooldownUntil: Function}} setters -
   *   React state setters: the `{repositories, pagination}` listing, the sync-state object,
   *   the `{page, filter, search}` query, the `{loading, error}` load state, the Add state
   *   `Map`, the dismissed banner keys `Set`, the Refresh notice, the current time and the
   *   cooldown end (epoch milliseconds).
   * @param {typeof RepositoriesClient} [client] - Repositories HTTP client override, for
   *   testability.
   */
  constructor(setters, client = RepositoriesClient) {
    Object.assign(this, setters);
    this.client = client;
    this.query = { ...INITIAL_QUERY };
    this.dismissals = new Set();
    this.disposed = false;
    this.syncing = false;
    this.searchTimer = null;
    this.addStore = new AddStateStore(setters.setAddState);
    this.countdown = new RefreshCountdown(setters.setNow);
    this.poller = new RepositoriesPoller(() => this.pollOnce());
  }

  /**
   * Load the current query's page, storing the rows, pagination and sync state. A page past
   * the end (above 1, with rows existing) jumps once to the last page.
   *
   * @param {boolean} [jumped] - Whether this load already is the empty-page jump.
   * @returns {Promise<void>} Resolves once the load finishes.
   */
  async load(jumped = false) {
    try {
      const data = await this.client.list(this.query);

      if (!data || this.disposed) {
        return;
      }

      if (!jumped && this.#pastTheEnd(data)) {
        await this.#jumpToLastPage(data.pagination.totalPages);
        return;
      }

      this.setListing({ repositories: data.repositories, pagination: data.pagination });
      this.setLoadState({ loading: false, error: null });
      this.#adoptSync(data.sync);
    } catch (error) {
      this.setLoadState({ loading: false, error: error?.message || LOAD_ERROR });
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
   * Change the filter, going back to the first page, and reload.
   *
   * @param {string} filter - `all`, `added`, `not_added` or `unavailable`.
   * @returns {Promise<void>} Resolves once the reload finishes.
   */
  async changeFilter(filter) {
    return this.#reloadWith({ filter, page: 1 });
  }

  /**
   * Change the page and reload.
   *
   * @param {number} page - The page to show.
   * @returns {Promise<void>} Resolves once the reload finishes.
   */
  async changePage(page) {
    return this.#reloadWith({ page });
  }

  /**
   * Change the search text, going back to the first page; the reload is debounced.
   *
   * @param {string} search - The search text.
   * @returns {void} Nothing.
   */
  changeSearch(search) {
    this.query = { ...this.query, search, page: 1 };
    this.setQuery(this.query);
    clearTimeout(this.searchTimer);
    this.searchTimer = setTimeout(() => this.load(), SEARCH_DEBOUNCE_MS);
  }

  /**
   * One poll: reads the sync state, reloading the page once it went idle.
   *
   * @returns {Promise<boolean>} `true` to keep polling; `false` on a `401` (the client
   *   resolved `undefined`), once idle, or when disposed.
   */
  async pollOnce() {
    const sync = await this.client.syncState();

    if (sync === undefined || this.disposed) {
      return false;
    }

    this.#adoptSync(sync);

    if (!this.syncing) {
      await this.load();
    }

    return this.syncing;
  }

  /**
   * Force a sync. A `202` stores the returned state and starts polling; a `429` shows the
   * cooldown notice and adopts its delay as the countdown's target.
   *
   * @returns {Promise<void>} Resolves once the request finishes.
   */
  async refresh() {
    this.setRefreshNotice(null);

    try {
      const sync = await this.client.refresh();

      if (sync) {
        this.#adoptSync(sync);
      }
    } catch (error) {
      this.#refreshFailed(error);
    }
  }

  /**
   * Add a repository: a spinner while running, the row marked Added in place on success, an
   * inline error on failure.
   *
   * @param {number} githubId - The repository's GitHub id.
   * @returns {Promise<void>} Resolves once the request finishes.
   */
  async add(githubId) {
    this.addStore.pending(githubId);

    try {
      const row = await this.client.add(githubId);

      this.addStore.clear(githubId);

      if (row) {
        this.#markAdded(githubId, row);
      }
    } catch (error) {
      this.addStore.fail(githubId, AddErrorMessages.describe(error));
    }
  }

  /**
   * Dismiss a source's banner, in memory only, until its next run.
   *
   * @param {object} source - The sync-state source entry.
   * @returns {void} Nothing.
   */
  dismiss(source) {
    this.dismissals = new Set(this.dismissals).add(SourceKeys.dismissalKey(source));
    this.setDismissed(this.dismissals);
  }

  /**
   * Stop every timer and clear the Add state (unmount).
   *
   * @returns {void} Nothing.
   */
  dispose() {
    this.disposed = true;
    this.poller.stop();
    this.countdown.stop();
    clearTimeout(this.searchTimer);
    this.addStore.clearAll();
  }

  async #reloadWith(changes) {
    this.query = { ...this.query, ...changes };
    this.setQuery(this.query);
    return this.load();
  }

  #pastTheEnd({ repositories, pagination }) {
    return repositories.length === 0 && this.query.page > 1 && pagination.total > 0;
  }

  async #jumpToLastPage(totalPages) {
    this.query = { ...this.query, page: totalPages };
    this.setQuery(this.query);
    await this.load(true);
  }

  #adoptSync(sync) {
    this.setSync(sync);
    this.syncing = sync.state === 'syncing';
    this.#trackCooldown(toTime(sync.refreshAvailableAt));

    if (this.syncing) {
      this.poller.start();
    } else {
      this.poller.stop();
    }
  }

  #trackCooldown(until) {
    this.setCooldownUntil(until);
    this.countdown.start(until);
  }

  #refreshFailed(error) {
    if (error?.status !== 429) {
      this.setRefreshNotice(error?.message || 'Request failed');
      return;
    }

    const seconds = error.retryAfterSeconds;

    if (seconds === undefined) {
      this.setRefreshNotice('Repositories were synced recently. Try again shortly.');
      return;
    }

    this.setRefreshNotice(`Repositories were synced recently. Try again in ${seconds} s.`);
    this.#trackCooldown(Date.now() + seconds * 1000);
  }

  #markAdded(githubId, row) {
    this.setListing((current) => ({
      ...current,
      repositories: current.repositories.map(
        (repository) => (repository.githubId === githubId ? { ...repository, ...row } : repository),
      ),
    }));
  }
}
