import currentHash from './currentHash.js';

/**
 * Reads and writes the browser location hash, SSR/spec-safe: writes are no-ops when `window`
 * is not defined.
 */
const HashLocation = {
  /**
   * Read the current hash.
   *
   * @returns {string} The current hash (with its `#` and query), or `''` without a window.
   */
  read() {
    return currentHash();
  },

  /**
   * Go to a hash, adding a history entry (so Back returns to the previous one).
   *
   * @param {string} hash - The hash to go to.
   * @returns {void} Nothing.
   */
  push(hash) {
    if (typeof window !== 'undefined') {
      window.location.hash = hash;
    }
  },

  /**
   * Rewrite the current hash in place, with no history entry and no `hashchange` event.
   *
   * @param {string} hash - The hash to show.
   * @returns {void} Nothing.
   */
  replace(hash) {
    if (typeof window !== 'undefined') {
      window.history.replaceState(window.history.state, '', hash);
    }
  },
};

export default HashLocation;
