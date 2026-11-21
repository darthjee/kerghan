/**
 * Escapes the `LIKE` metacharacters (`%`, `_`, `\`) so they match literally (`ESCAPE '\'`). Shared
 * by the Repositories and Issues listings' `search`.
 * @param {string} value - The search text.
 * @returns {string} The escaped text.
 */
export function escapeLike(value: string): string {
  return value.replace(/[\\%_]/g, (char) => `\\${char}`);
}
