/**
 * Classifies a redirect of an issue call by its `Location` (E65, see
 * `docs/agents/specs/issues/security.md#redirects-never-carry-a-credential-off-github`).
 * Pure: the client acts on the answer. No credential is ever sent to a URL
 * this module did not rebuild from `GITHUB_API_URL` and two integer ids.
 */
import { GITHUB_API_URL } from './github-client.service.js';
import type { GithubIssueRepo } from './github-issue-results.js';

/**
 * What a redirect's `Location` means:
 * - `renamed`: the same repository id and issue number; `url` is rebuilt, never copied;
 * - `moved`: another `api.github.com` target (a transfer);
 * - `unclassifiable`: anything else; it is never followed.
 */
export type IssueRedirect =
  | { kind: 'renamed'; url: string }
  | { kind: 'moved' }
  | { kind: 'unclassifiable' };

// The statuses treated as a redirect to classify; any other 3xx is `unavailable{redirect}`.
const REDIRECT_STATUSES = new Set([301, 302, 307, 308]);
// `/repositories/{id}/issues/{number}`, decimal digits only.
const RENAME_PATH = /^\/repositories\/(\d+)\/issues\/(\d+)$/;

/**
 * Whether a status is one of the redirects to classify by `Location`.
 * @param {number} status - The HTTP status.
 * @returns {boolean} `true` for `301`, `302`, `307` and `308`.
 */
export function isIssueRedirectStatus(status: number): boolean {
  return REDIRECT_STATUSES.has(status);
}

/**
 * Classifies a redirect's `Location` for one issue.
 * @param {string | null} location - The `Location` header.
 * @param {GithubIssueRepo} repo - The repository the call targeted.
 * @param {number} number - The issue number the call targeted.
 * @returns {IssueRedirect} `renamed` (with the rebuilt URL), `moved` or `unclassifiable`.
 */
export function classifyIssueRedirect(location: string | null, repo: GithubIssueRepo, number: number): IssueRedirect {
  const url = parseGithubLocation(location);

  if (url === null) {
    return { kind: 'unclassifiable' };
  }

  const match = RENAME_PATH.exec(url.pathname);

  if (match !== null && match[1] === String(repo.githubId) && match[2] === String(number)) {
    return { kind: 'renamed', url: `${GITHUB_API_URL}/repositories/${repo.githubId}/issues/${number}` };
  }

  // Assumption: any other api.github.com target means the issue was transferred. GitHub's
  // transfer `Location` has not been observed yet; the opt-in live mode of
  // `github-issue-redirect.contract.spec.ts` records it.
  return { kind: 'moved' };
}

/**
 * Parses a `Location` that is on `https://api.github.com` with no port,
 * credentials, query or fragment.
 * @param {string | null} location - The `Location` header.
 * @returns {URL | null} The URL, or `null` when missing, malformed or elsewhere.
 */
function parseGithubLocation(location: string | null): URL | null {
  // The prefix check also rejects an explicit port, which `URL` would normalise away.
  if (location === null || !location.startsWith(`${GITHUB_API_URL}/`)) {
    return null;
  }

  let url: URL;

  try {
    url = new URL(location);
  } catch {
    return null;
  }

  const onGithub = url.protocol === 'https:' && url.hostname === 'api.github.com' && url.port === '';
  const plain = url.username === '' && url.password === '' && url.search === '' && url.hash === '';

  return onGithub && plain && !location.includes('?') && !location.includes('#') ? url : null;
}
