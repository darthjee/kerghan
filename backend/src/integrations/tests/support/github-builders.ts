import { DEFAULT_RATE_LIMIT_REMAINING, DEFAULT_RATE_LIMIT_RESET, jsonResponse, rateLimitHeaders, rawRepo } from './github-raw.js';
import type {
  GithubRepo,
  IntegrationUnusableReason,
  RateLimitFields,
  RepoPageResult,
  RepoResult,
} from '../../github-repo-results.js';

export {
  DEFAULT_RATE_LIMIT_REMAINING,
  DEFAULT_RATE_LIMIT_RESET,
  jsonResponse,
  rateLimitHeaders,
  rawRepo,
  replyOnce,
} from './github-raw.js';

/**
 * The shared, typed GitHub builders (`docs/agents/modules/repositories.md#shared-builders`).
 * Each case gives both the raw `fetch` answer (body, `ETag`, `Link`,
 * `X-RateLimit-*` headers) the Integrations specs reply with, and the typed
 * result the real service answers for it — which is what
 * `FakeIntegrationsGithubService` returns for the same case. The contract
 * spec (`integrations-github.contract.spec.ts`) keeps the two in step.
 *
 * Authenticated cases assume a `pat` / `oauth_app` integration (a
 * `github_app` call's `401` follows the installation-token retry rule).
 */

/** The exported operations a case can answer. */
export type GithubOperation = 'listRepositories' | 'listHandleRepositories' | 'getRepository';

/** How a listing body is shaped: a plain array, or `GET /installation/repositories`' object. */
export type ListingShape = 'array' | 'installation';

/** One builder case. */
export interface GithubCase {
  readonly name: string;
  /**
   * The raw `fetch` answer: a `Response`, a thrown error (timeout), or
   * `null` when the service answers without any GitHub call.
   */
  readonly raw: ((shape: ListingShape) => Response) | { throws: () => unknown } | null;
  /**
   * The typed result an operation answers for this case.
   * @param operation - The operation.
   * @returns The typed result.
   */
  resultFor(operation: GithubOperation): RepoPageResult | RepoResult;
}

// Default ids sit above 2³¹, so a 32-bit truncation anywhere shows up.
const DEFAULT_ID_BASE = 2 ** 31 + 1000;

let nextRepo = 0;

/** The rate-limit fields matching `rateLimitHeaders()`. */
export const DEFAULT_RATE_LIMIT: RateLimitFields = {
  rateLimitRemaining: DEFAULT_RATE_LIMIT_REMAINING,
  rateLimitReset: DEFAULT_RATE_LIMIT_RESET,
  retryAfter: null,
};

/**
 * Builds a repo, with an id above 2³¹ by default.
 * @param {Partial<{ id: number, private: boolean, owner: string, name: string }>} attributes - Overrides.
 * @returns {GithubRepo} The repo.
 */
export function githubRepo(
  attributes: Partial<{ id: number; private: boolean; owner: string; name: string }> = {},
): GithubRepo {
  nextRepo += 1;

  return {
    githubId: attributes.id ?? DEFAULT_ID_BASE + nextRepo,
    owner: attributes.owner ?? 'octo-org',
    name: attributes.name ?? `repo-${nextRepo}`,
    private: attributes.private ?? false,
  };
}

/**
 * A listing page.
 * @param {number} page - The page number (used for the `Link` header).
 * @param {GithubRepo[]} repos - The page's repos.
 * @param {{ hasNext?: boolean, etag?: string | null }} [options] - Whether a next page exists, and the `ETag`.
 * @returns {GithubCase} The case.
 */
export function listingPage(
  page: number,
  repos: GithubRepo[],
  options: { hasNext?: boolean; etag?: string | null } = {},
): GithubCase {
  const hasNext = options.hasNext ?? false;
  const etag = options.etag === undefined ? `W/"etag-page-${page}"` : options.etag;
  // A same-origin `Link` the client must never request.
  const link = `<https://api.github.com/user/repos?per_page=100&page=${page + 1}>; rel="next", `
    + '<https://api.github.com/user/repos?per_page=100&page=99>; rel="last"';

  return {
    name: `listingPage(${page}, ${repos.length} repos, hasNext=${hasNext})`,
    raw: (shape) => {
      const entries = repos.map(rawRepo);
      const body = shape === 'installation' ? { total_count: entries.length, repositories: entries } : entries;

      return jsonResponse(200, body, {
        ...(etag === null ? {} : { etag }),
        ...(hasNext ? { link } : { link: link.split(', ')[1] }),
      });
    },
    resultFor: (operation) => {
      if (operation === 'getRepository') {
        throw new Error('listingPage() is a listing case');
      }

      return { kind: 'ok', repos, etag, hasNext, rateLimit: DEFAULT_RATE_LIMIT };
    },
  };
}

/**
 * `GET /repositories/{id}` answering a repo.
 * @param {GithubRepo} repo - The repo.
 * @returns {GithubCase} The case.
 */
export function repository(repo: GithubRepo): GithubCase {
  return {
    name: `repository(${repo.githubId})`,
    raw: () => jsonResponse(200, rawRepo(repo)),
    resultFor: (operation) => {
      if (operation !== 'getRepository') {
        throw new Error('repository() is a getRepository case');
      }

      return { kind: 'ok', repo };
    },
  };
}

/**
 * A `304` for a conditional listing.
 * @returns {GithubCase} The case.
 */
export function notModified(): GithubCase {
  return {
    name: 'notModified()',
    raw: () => new Response(null, { status: 304, headers: rateLimitHeaders({ etag: 'W/"same"' }) }),
    resultFor: (operation) => (operation === 'getRepository'
      ? { kind: 'unavailable', reason: 'unexpected' }
      : { kind: 'not_modified', rateLimit: DEFAULT_RATE_LIMIT }),
  };
}

/**
 * A primary rate limit (`403`, `X-RateLimit-Remaining: 0`).
 * @param {Date} resetAt - When the window resets (truncated to the second).
 * @returns {GithubCase} The case.
 */
export function rateLimited(resetAt: Date): GithubCase {
  const seconds = Math.floor(resetAt.getTime() / 1000);

  return {
    name: 'rateLimited()',
    raw: () => jsonResponse(403, { message: 'API rate limit exceeded CANARYcanaryBODY' }, {
      'x-ratelimit-remaining': '0',
      'x-ratelimit-reset': String(seconds),
    }),
    resultFor: () => ({ kind: 'rate_limited', resetAt: new Date(seconds * 1000) }),
  };
}

/**
 * A `401` on an authenticated call.
 * @returns {GithubCase} The case.
 */
export function unauthorized(): GithubCase {
  return {
    name: 'unauthorized()',
    raw: () => jsonResponse(401, { message: 'Bad credentials CANARYcanaryBODY' }),
    resultFor: () => ({ kind: 'invalid_credentials' }),
  };
}

/**
 * A `403` that is not a rate limit.
 * @returns {GithubCase} The case.
 */
export function forbidden(): GithubCase {
  return {
    name: 'forbidden()',
    raw: () => jsonResponse(403, { message: 'Resource not accessible CANARYcanaryBODY' }),
    resultFor: (operation) => (operation === 'getRepository'
      ? { kind: 'not_found' }
      : { kind: 'unavailable', reason: 'forbidden' }),
  };
}

/**
 * A `404`.
 * @returns {GithubCase} The case.
 */
export function notFound(): GithubCase {
  return {
    name: 'notFound()',
    raw: () => jsonResponse(404, { message: 'Not Found CANARYcanaryBODY' }),
    resultFor: (operation) => (operation === 'listRepositories'
      ? { kind: 'unavailable', reason: 'unexpected' }
      : { kind: 'not_found' }),
  };
}

/**
 * The per-call timeout firing.
 * @returns {GithubCase} The case.
 */
export function timeout(): GithubCase {
  return {
    name: 'timeout()',
    raw: { throws: () => new DOMException('The operation timed out.', 'TimeoutError') },
    resultFor: () => ({ kind: 'unavailable', reason: 'timeout' }),
  };
}

/**
 * A `5xx`.
 * @returns {GithubCase} The case.
 */
export function serverError(): GithubCase {
  return {
    name: 'serverError()',
    raw: () => jsonResponse(502, { message: 'Server Error CANARYcanaryBODY' }),
    resultFor: () => ({ kind: 'unavailable', reason: 'server_error' }),
  };
}

/**
 * A same-origin `301`, which is never followed.
 * @returns {GithubCase} The case.
 */
export function redirect(): GithubCase {
  return {
    name: 'redirect()',
    raw: () => new Response(null, {
      status: 301,
      headers: rateLimitHeaders({ location: 'https://api.github.com/repositories/1' }),
    }),
    resultFor: () => ({ kind: 'unavailable', reason: 'redirect' }),
  };
}

/**
 * An integration the service refuses to call (no GitHub call at all).
 * @param {IntegrationUnusableReason} reason - Why.
 * @returns {GithubCase} The case.
 */
export function integrationUnusable(reason: IntegrationUnusableReason): GithubCase {
  return {
    name: `integrationUnusable(${reason})`,
    raw: null,
    resultFor: () => ({ kind: 'integration_unusable', reason }),
  };
}
