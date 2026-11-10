/**
 * GitHub's username format, applied to an already-normalised (lowercased)
 * handle: letters and digits, single hyphens only (no `--`), no leading or
 * trailing hyphen, 1 to 39 characters. See
 * `docs/agents/specs/repos/model.md#validation`.
 */
export const GITHUB_HANDLE_FORMAT = /^[a-z0-9](?:[a-z0-9]|-(?=[a-z0-9])){0,38}$/;

/** Field message answered when a handle fails `GITHUB_HANDLE_FORMAT`. */
export const GITHUB_HANDLE_MESSAGE = 'githubHandle must be a valid GitHub username';

/**
 * Normalises a requested GitHub handle into its stored, canonical form:
 * trims surrounding whitespace, strips one leading `@`, and lowercases (GitHub
 * logins are case-insensitive). An empty result, like `null`, means "clear".
 * @param {string | null} value - The handle as sent in the request.
 * @returns {string | null} The canonical handle, or `null` to clear it.
 */
export function normalizeGithubHandle(value: string | null): string | null {
  if (value === null) {
    return null;
  }

  const handle = value.trim().replace(/^@/, '').toLowerCase();

  return handle === '' ? null : handle;
}

/**
 * Reports whether an already-normalised handle matches GitHub's username
 * format.
 * @param {string} handle - The normalised handle.
 * @returns {boolean} `true` when the handle is a valid GitHub username.
 */
export function isValidGithubHandle(handle: string): boolean {
  return GITHUB_HANDLE_FORMAT.test(handle);
}
