import { Injectable } from '@nestjs/common';
import type { Secret } from './secret.js';

// GitHub REST API base URL.
export const GITHUB_API_URL = 'https://api.github.com';
// REST API version pinned on every request.
export const GITHUB_API_VERSION = '2022-11-28';
// User-Agent GitHub requires on every request.
export const GITHUB_USER_AGENT = 'kerghan';
// Upper bound for a single GitHub call, in milliseconds.
export const GITHUB_TIMEOUT_MS = 10_000;

/** Why a GitHub call failed without an HTTP answer. */
export type GithubClientErrorReason = 'timeout' | 'network_error';

/**
 * Sanitized error for a GitHub call that got no HTTP answer (network error or
 * timeout). It carries only a short reason (and a status, when one exists):
 * no request config, headers, URL or original `cause`, so nothing that could
 * hold a credential ever reaches a log or a response.
 */
export class GithubClientError extends Error {
  readonly reason: GithubClientErrorReason;
  readonly status: number | null;

  /**
   * @param {GithubClientErrorReason} reason - Short, safe failure reason.
   * @param {number | null} [status] - The HTTP status, when one exists.
   */
  constructor(reason: GithubClientErrorReason, status: number | null = null) {
    super(`GitHub request failed: ${reason}`);
    this.name = 'GithubClientError';
    this.reason = reason;
    this.status = status;
  }
}

/**
 * The typed, header-normalised answer of `GET /user`. Never a raw response.
 */
export interface GithubUserResponse {
  /** HTTP status GitHub answered with. */
  status: number;
  /** The `login` of the authenticated identity (200 only), or `null`. */
  login: string | null;
  /** Raw `X-OAuth-Scopes` header (comma-separated), or `null` when absent. */
  oauthScopes: string | null;
  /** Raw `GitHub-Authentication-Token-Expiration` header, or `null` when absent. */
  tokenExpiration: string | null;
  /** `X-RateLimit-Remaining`, or `null` when absent or not numeric. */
  rateLimitRemaining: number | null;
  /** `X-RateLimit-Reset` (epoch seconds), or `null` when absent or not numeric. */
  rateLimitReset: number | null;
  /** `Retry-After` (seconds), or `null` when absent or not numeric. */
  retryAfter: number | null;
}

/**
 * The only place in the backend that calls GitHub. Every integration type
 * talks to GitHub through this service, so specs replace it with a fake
 * (`tests/support/fake-github-client.ts`); only its own spec stubs `fetch`.
 */
@Injectable()
export class GithubClientService {
  /**
   * Calls `GET /user` with a token.
   * @param {Secret<string>} token - The token, unwrapped only for the `Authorization` header.
   * @returns {Promise<GithubUserResponse>} GitHub's normalised answer, whatever its status.
   */
  async getUser(token: Secret<string>): Promise<GithubUserResponse> {
    try {
      const response = await fetch(`${GITHUB_API_URL}/user`, {
        method: 'GET',
        headers: {
          Authorization: `Bearer ${token.reveal()}`,
          Accept: 'application/vnd.github+json',
          'X-GitHub-Api-Version': GITHUB_API_VERSION,
          'User-Agent': GITHUB_USER_AGENT,
        },
        signal: AbortSignal.timeout(GITHUB_TIMEOUT_MS),
      });
      const body = await response.text();

      return normalise(response.status, response.headers, body);
    } catch (error) {
      throw new GithubClientError(isTimeout(error) ? 'timeout' : 'network_error');
    }
  }
}

/**
 * Builds the normalised answer from the status, headers and body text.
 * @param {number} status - The HTTP status.
 * @param {Headers} headers - The response headers.
 * @param {string} body - The response body text.
 * @returns {GithubUserResponse} The normalised answer.
 */
function normalise(status: number, headers: Headers, body: string): GithubUserResponse {
  return {
    status,
    login: status === 200 ? parseLogin(body) : null,
    oauthScopes: headers.get('x-oauth-scopes'),
    tokenExpiration: headers.get('github-authentication-token-expiration'),
    rateLimitRemaining: numericHeader(headers, 'x-ratelimit-remaining'),
    rateLimitReset: numericHeader(headers, 'x-ratelimit-reset'),
    retryAfter: numericHeader(headers, 'retry-after'),
  };
}

/**
 * Reads the `login` field of a JSON body.
 * @param {string} body - The response body text.
 * @returns {string | null} The non-empty login, or `null` when absent or unparseable.
 */
function parseLogin(body: string): string | null {
  try {
    const { login } = JSON.parse(body) as { login?: unknown };

    return typeof login === 'string' && login !== '' ? login : null;
  } catch {
    return null;
  }
}

/**
 * Reads a numeric header.
 * @param {Headers} headers - The response headers.
 * @param {string} name - The header name.
 * @returns {number | null} The number, or `null` when absent or not numeric.
 */
function numericHeader(headers: Headers, name: string): number | null {
  const raw = headers.get(name);

  if (raw === null || raw.trim() === '') {
    return null;
  }

  const value = Number(raw);

  return Number.isFinite(value) ? value : null;
}

/**
 * Whether a fetch failure was the timeout signal firing.
 * @param {unknown} error - The caught value.
 * @returns {boolean} `true` for a timeout/abort.
 */
function isTimeout(error: unknown): boolean {
  // Duck-typed: `DOMException` may come from another realm, so `instanceof Error` isn't reliable.
  const name = typeof error === 'object' && error !== null ? (error as { name?: unknown }).name : undefined;

  return name === 'TimeoutError' || name === 'AbortError';
}
