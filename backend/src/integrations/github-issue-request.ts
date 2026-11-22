/**
 * The pure request-building half of the issue client: the fixed paths, built only
 * from the stored `owner`, `name` and `number` (each URL-encoded, on the fixed
 * `https://api.github.com` base) and the write body, copied from an allowlist of
 * three fields. Internal to the Integrations module.
 */
import type { GithubIssueChanges, GithubIssueRepo } from './github-issue-results.js';

// The only fields a write may send.
const CHANGE_FIELDS: ReadonlySet<string> = new Set(['title', 'body', 'state']);

/**
 * `/repos/{owner}/{name}`, each part URL-encoded.
 * @param {GithubIssueRepo} repo - The repository.
 * @returns {string} The path.
 */
export function repoPath(repo: GithubIssueRepo): string {
  assertPositiveInteger(repo.githubId, 'githubId');

  for (const part of [repo.owner, repo.name]) {
    if (part === '' || part === '.' || part === '..') {
      throw new RangeError('owner and name must be real names');
    }
  }

  return `/repos/${encodeURIComponent(repo.owner)}/${encodeURIComponent(repo.name)}`;
}

/**
 * `/repos/{owner}/{name}/issues/{number}`.
 * @param {GithubIssueRepo} repo - The repository.
 * @param {number} number - The issue number.
 * @returns {string} The path.
 */
export function issuePath(repo: GithubIssueRepo, number: number): string {
  assertPositiveInteger(number, 'number');

  return `${repoPath(repo)}/issues/${number}`;
}

/**
 * @param {number} value - The value.
 * @param {string} name - Its name, for the message.
 * @returns {void}
 */
function assertPositiveInteger(value: number, name: string): void {
  if (!Number.isSafeInteger(value) || value <= 0) {
    throw new RangeError(`${name} must be a positive integer`);
  }
}

/**
 * Builds the write body by copying the three allowed fields; it throws on
 * any other own key, an invalid `state` or an empty diff.
 * @param {GithubIssueChanges} changes - The diff.
 * @returns {Record<string, unknown>} The body to send.
 */
export function allowlistedBody(changes: GithubIssueChanges): Record<string, unknown> {
  if (Object.keys(changes).some((key) => !CHANGE_FIELDS.has(key))) {
    throw new RangeError('changes may only hold title, body and state');
  }

  const payload: Record<string, unknown> = {};

  if (changes.title !== undefined) {
    payload.title = assertText(changes.title, 'title');
  }

  if (changes.body !== undefined) {
    payload.body = changes.body === null ? null : assertText(changes.body, 'body');
  }

  if (changes.state !== undefined) {
    payload.state = assertState(changes.state);
  }

  if (Object.keys(payload).length === 0) {
    throw new RangeError('changes must not be empty');
  }

  return payload;
}

/**
 * @param {unknown} value - The value.
 * @param {string} name - Its name, for the message.
 * @returns {string} The value, when it is a string.
 */
function assertText(value: unknown, name: string): string {
  if (typeof value !== 'string') {
    throw new RangeError(`${name} must be a string`);
  }

  return value;
}

/**
 * @param {unknown} value - The value.
 * @returns {'open' | 'closed'} The value, when it is `open` or `closed`.
 */
function assertState(value: unknown): 'open' | 'closed' {
  if (value !== 'open' && value !== 'closed') {
    throw new RangeError('state must be open or closed');
  }

  return value;
}
