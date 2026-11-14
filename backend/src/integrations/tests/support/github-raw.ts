import type { GithubCase, ListingShape } from './github-builders.js';
import type { GithubRepo } from '../../github-repo-results.js';

/**
 * Raw GitHub answers for the `fetch`-level Integrations specs: JSON bodies
 * with the default rate-limit headers, and the scripting of a builder case
 * onto the guarded `fetch` mock.
 */

// A fixed reset, in epoch seconds (2026-01-01T01:00:00Z).
export const DEFAULT_RATE_LIMIT_RESET = 1_767_229_200;
// The remaining count every non-limited answer carries.
export const DEFAULT_RATE_LIMIT_REMAINING = 4_999;

/**
 * The raw GitHub JSON of a repo, with fields the client must discard.
 * @param {GithubRepo} repo - The repo.
 * @returns {Record<string, unknown>} GitHub's object.
 */
export function rawRepo(repo: GithubRepo): Record<string, unknown> {
  return {
    id: repo.githubId,
    node_id: 'R_kgDOAAAAAA',
    name: repo.name,
    full_name: `${repo.owner}/${repo.name}`,
    private: repo.private,
    owner: { login: repo.owner, id: 1, type: 'Organization' },
    html_url: `https://github.com/${repo.owner}/${repo.name}`,
    description: 'discarded',
  };
}

/**
 * The default `X-RateLimit-*` headers.
 * @param {Record<string, string>} [extra] - More headers.
 * @returns {Record<string, string>} The headers.
 */
export function rateLimitHeaders(extra: Record<string, string> = {}): Record<string, string> {
  return {
    'x-ratelimit-limit': '5000',
    'x-ratelimit-remaining': String(DEFAULT_RATE_LIMIT_REMAINING),
    'x-ratelimit-reset': String(DEFAULT_RATE_LIMIT_RESET),
    ...extra,
  };
}

/**
 * A JSON response with the default rate-limit headers.
 * @param {number} status - The HTTP status.
 * @param {unknown} body - The JSON body.
 * @param {Record<string, string>} [headers] - More headers (override the defaults).
 * @returns {Response} The response.
 */
export function jsonResponse(status: number, body: unknown, headers: Record<string, string> = {}): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { 'content-type': 'application/json', ...rateLimitHeaders(headers) },
  });
}

/**
 * Scripts the next `fetch` call of a guarded spec with a case's raw answer.
 * @param {jest.Mock} fetch - The guarded `fetch` mock.
 * @param {GithubCase} githubCase - The case.
 * @param {ListingShape} [shape] - The listing body shape.
 * @returns {void}
 */
export function replyOnce(fetch: jest.Mock, githubCase: GithubCase, shape: ListingShape = 'array'): void {
  const { raw } = githubCase;

  if (raw === null) {
    throw new Error(`${githubCase.name} makes no GitHub call`);
  }

  if (typeof raw === 'function') {
    fetch.mockImplementationOnce(async () => raw(shape));
  } else {
    fetch.mockImplementationOnce(async () => {
      throw raw.throws();
    });
  }
}
