import { GithubClientError, GithubClientService, GithubUserResponse } from './github-client.service.js';
import type { Secret } from './secret.js';

/**
 * GitHub's `GET /user` answer, reduced to what every type maps from:
 * - `ok`: 200 with a usable `login`;
 * - `unauthorized`: 401;
 * - `rate_limited`: 403/429 with `x-ratelimit-remaining: 0` or a `retry-after`;
 * - `unavailable`: network error, timeout, 5xx, any other status, or a 200 without `login`.
 */
export type GithubUserAnswer =
  | { kind: 'ok'; login: string; response: GithubUserResponse }
  | { kind: 'unauthorized' }
  | { kind: 'rate_limited'; retryAfterSeconds?: number }
  | { kind: 'unavailable' };

// Statuses GitHub uses for primary and secondary rate limits.
const RATE_LIMIT_STATUSES = new Set([403, 429]);

/**
 * Calls `GET /user` and classifies the answer; never throws for a
 * `GithubClientError` (it becomes `unavailable`).
 * @param {GithubClientService} client - The shared GitHub client.
 * @param {Secret<string>} token - The token to authenticate with.
 * @param {number} [now] - Current epoch milliseconds, for `x-ratelimit-reset`.
 * @returns {Promise<GithubUserAnswer>} The classified answer.
 */
export async function fetchGithubUser(
  client: Pick<GithubClientService, 'getUser'>,
  token: Secret<string>,
  now: number = Date.now(),
): Promise<GithubUserAnswer> {
  try {
    return classifyGithubUser(await client.getUser(token), now);
  } catch (error) {
    if (error instanceof GithubClientError) {
      return { kind: 'unavailable' };
    }

    throw error;
  }
}

/**
 * Classifies a normalised `GET /user` answer.
 * @param {GithubUserResponse} response - The normalised answer.
 * @param {number} now - Current epoch milliseconds, for `x-ratelimit-reset`.
 * @returns {GithubUserAnswer} The classified answer.
 */
export function classifyGithubUser(response: GithubUserResponse, now: number): GithubUserAnswer {
  if (response.status === 200 && response.login !== null) {
    return { kind: 'ok', login: response.login, response };
  }

  if (response.status === 401) {
    return { kind: 'unauthorized' };
  }

  if (isRateLimited(response)) {
    return { kind: 'rate_limited', retryAfterSeconds: retryAfterSecondsFor(response, now) };
  }

  return { kind: 'unavailable' };
}

/**
 * Whether an answer is a primary or secondary rate limit.
 * @param {GithubUserResponse} response - The normalised answer.
 * @returns {boolean} `true` for a 403/429 with `x-ratelimit-remaining: 0` or a `retry-after`.
 */
function isRateLimited(response: GithubUserResponse): boolean {
  return RATE_LIMIT_STATUSES.has(response.status)
    && (response.rateLimitRemaining === 0 || response.retryAfter !== null);
}

/**
 * Seconds until GitHub accepts calls again: `retry-after`, else
 * `x-ratelimit-reset` minus now, rounded up and never negative.
 * @param {GithubUserResponse} response - The normalised answer.
 * @param {number} now - Current epoch milliseconds.
 * @returns {number | undefined} The delay, or `undefined` when GitHub gave none.
 */
export function retryAfterSecondsFor(response: GithubUserResponse, now: number): number | undefined {
  if (response.retryAfter !== null) {
    return Math.max(0, Math.ceil(response.retryAfter));
  }

  if (response.rateLimitReset !== null) {
    return Math.max(0, Math.ceil(response.rateLimitReset - now / 1000));
  }

  return undefined;
}
