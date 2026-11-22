/** Longest search text the API accepts, in code points. */
export const MAX_SEARCH_LENGTH = 100;

/**
 * Parse a `page` value: a positive integer, else the first page.
 *
 * @param {(string|null)} value - The raw query value.
 * @returns {number} The page.
 */
function parsePage(value) {
  const page = /^[1-9]\d*$/.test(value ?? '') ? Number(value) : 1;

  return Number.isSafeInteger(page) ? page : 1;
}

/**
 * Parse a `search` value: truncated to {@link MAX_SEARCH_LENGTH} code points.
 *
 * @param {(string|null)} value - The raw query value.
 * @returns {string} The search text.
 */
function parseSearch(value) {
  return Array.from(value ?? '').slice(0, MAX_SEARCH_LENGTH).join('');
}

/**
 * Hash-query handling of the lists (`state`, `search` and `page`), shared by the project list
 * and the issue list (#561). Every value is normalized before it is used, so a hand-typed URL
 * never makes the API answer a `400` (U6).
 */
const ListQuery = {
  /**
   * Parse the query of a hash, normalizing every value.
   *
   * @param {string} hash - The location hash (e.g. `#/projects?search=foo&page=2`).
   * @param {{states: (string[]|undefined)}} [options] - The allowed `state` values for a list
   *   with a state filter; the first one is the default. Without it no `state` is read.
   * @returns {{page: number, search: string, state: (string|undefined)}} The query: `page` a
   *   positive integer (else 1), `search` truncated to 100 code points, `state` one of the
   *   allowed values (else the default).
   */
  parse(hash, { states } = {}) {
    const params = new URLSearchParams(String(hash).split('?').slice(1).join('?'));
    const query = { page: parsePage(params.get('page')), search: parseSearch(params.get('search')) };

    if (states === undefined) {
      return query;
    }

    const state = params.get('state');

    return { ...query, state: states.includes(state) ? state : states[0] };
  },

  /**
   * Build the hash of a list, leaving the default values out of the query.
   *
   * @param {string} path - The list's path (e.g. `/projects`).
   * @param {{page: number, search: string, state: (string|undefined)}} query - The query.
   * @param {{states: (string[]|undefined)}} [options] - The allowed `state` values, as for
   *   {@link ListQuery.parse}.
   * @returns {string} The hash (e.g. `#/projects?search=foo&page=2`).
   */
  toHash(path, query, { states } = {}) {
    const params = new URLSearchParams();

    if (states !== undefined && query.state !== states[0]) {
      params.set('state', query.state);
    }

    if (query.search !== '') {
      params.set('search', query.search);
    }

    if (query.page > 1) {
      params.set('page', String(query.page));
    }

    const text = params.toString();

    return text === '' ? `#${path}` : `#${path}?${text}`;
  },

  /**
   * Truncate a search text typed by the user.
   *
   * @param {string} value - The typed text.
   * @returns {string} The text, at most 100 code points long.
   */
  truncateSearch(value) {
    return parseSearch(value);
  },
};

export default ListQuery;
