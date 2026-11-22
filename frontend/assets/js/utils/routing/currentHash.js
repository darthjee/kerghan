/**
 * Read the current browser location hash, SSR/spec-safe.
 *
 * @returns {string} The current `window.location.hash`, or `''` when `window` is not defined
 *   (e.g. during a Node-based spec run).
 */
export default function currentHash() {
  return typeof window === 'undefined' ? '' : window.location.hash;
}
