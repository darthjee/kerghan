/**
 * The pure halves of the repo client: the error-mapping table and the body
 * parsing (see `docs/agents/specs/repos/integrations.md#error-mapping`).
 * Rate limits are read from headers only; no body is parsed for a message.
 */
import { type GithubRateLimitFields, parseJsonObject } from './github-http.js';
import type { GithubRepo, RepoFailure, UnavailableReason } from './github-repo-results.js';
import { Secret } from './secret.js';
import type { Clock } from '../core/clock.js';

/** The fixed repo operations, as the error mapping distinguishes them. */
export type RepoOperation = 'user_repos' | 'installation_repos' | 'handle_repos' | 'repository';

/** What a non-`200` answer classifies as (`null` for a `200`, whose body is parsed next). */
export type RepoClassification =
  | { kind: 'not_modified' }
  | { kind: 'not_found' }
  | RepoFailure;

/** An `unavailable` result. */
export type UnavailableResult = { kind: 'unavailable'; reason: UnavailableReason };

/** The outcome of an installation-token mint. The token never leaves the module. */
export type InstallationTokenMint =
  | { kind: 'ok'; token: Secret<string>; expiresAt: Date }
  | { kind: 'uninstalled' }
  | { kind: 'suspended' }
  | { kind: 'jwt_rejected' }
  | { kind: 'rate_limited'; resetAt: Date | null }
  | { kind: 'unavailable'; reason: UnavailableReason };

// Longest GitHub login.
const OWNER_MAX_LENGTH = 39;
// Longest GitHub repository name.
const NAME_MAX_LENGTH = 100;
// Statuses GitHub uses for primary and secondary rate limits.
const RATE_LIMIT_STATUSES = new Set([403, 429]);

/**
 * Classifies a GitHub answer by its status and rate-limit headers, per the
 * error-mapping table.
 * @param {RepoOperation} operation - The operation that was called.
 * @param {number} status - The HTTP status.
 * @param {GithubRateLimitFields} rateLimit - The normalised rate-limit headers.
 * @param {boolean} authenticated - Whether the call carried a credential.
 * @param {Clock} clock - The time source, for `now + Retry-After`.
 * @returns {RepoClassification | null} The classification, or `null` for a `200`.
 */
export function classifyRepoResponse(
  operation: RepoOperation,
  status: number,
  rateLimit: GithubRateLimitFields,
  authenticated: boolean,
  clock: Clock,
): RepoClassification | null {
  if (status === 200) {
    return null;
  }

  if (isRateLimitAnswer(status, rateLimit)) {
    return { kind: 'rate_limited', resetAt: resetAtFor(rateLimit, clock) };
  }

  return classifyStatus(operation, status, authenticated);
}

/**
 * Whether an answer is a primary or secondary rate limit, read from headers only.
 * @param {number} status - The HTTP status.
 * @param {GithubRateLimitFields} rateLimit - The normalised rate-limit headers.
 * @returns {boolean} `true` for a `403`/`429` with `X-RateLimit-Remaining: 0` or a `Retry-After`.
 */
export function isRateLimitAnswer(status: number, rateLimit: GithubRateLimitFields): boolean {
  return RATE_LIMIT_STATUSES.has(status) && (rateLimit.rateLimitRemaining === 0 || rateLimit.retryAfter !== null);
}

/**
 * When GitHub accepts calls again: `now + Retry-After` when GitHub gave one
 * (a secondary limit), else `X-RateLimit-Reset`.
 * @param {GithubRateLimitFields} rateLimit - The normalised rate-limit headers.
 * @param {Clock} clock - The time source.
 * @returns {Date | null} The reset instant, or `null` when GitHub gave none.
 */
export function resetAtFor(rateLimit: GithubRateLimitFields, clock: Clock): Date | null {
  if (rateLimit.retryAfter !== null) {
    return new Date(clock.now().getTime() + Math.max(0, rateLimit.retryAfter) * 1000);
  }

  return rateLimit.rateLimitReset === null ? null : new Date(rateLimit.rateLimitReset * 1000);
}

/**
 * Parses the repos of a listing body, dropping malformed entries.
 * @param {RepoOperation} operation - The listing (`installation_repos` reads `{ repositories }`).
 * @param {string | null} body - The body text, or `null` when over the cap.
 * @returns {GithubRepo[] | null} The repos, or `null` when the body is not a listing.
 */
export function parseRepoListing(operation: RepoOperation, body: string | null): GithubRepo[] | null {
  const entries = operation === 'installation_repos' ? parseJsonObject(body).repositories : parseJsonArray(body);

  if (!Array.isArray(entries)) {
    return null;
  }

  return entries.map(parseRepo).filter((repo): repo is GithubRepo => repo !== null);
}

/**
 * Parses one repo object, keeping only the model's fields.
 * @param {unknown} raw - The entry.
 * @returns {GithubRepo | null} The repo, or `null` when malformed.
 */
export function parseRepo(raw: unknown): GithubRepo | null {
  const entry = asObject(raw);
  const login = asObject(entry.owner).login;
  const { id, name } = entry;

  if (!isGithubId(id) || !isBoundedString(login, OWNER_MAX_LENGTH) || !isBoundedString(name, NAME_MAX_LENGTH)
    || typeof entry.private !== 'boolean') {
    return null;
  }

  return { githubId: id, owner: login, name, private: entry.private };
}

/**
 * Parses a mint's `201` body into a `Secret` and its `expires_at`.
 * @param {string | null} body - The body text, or `null` when over the cap.
 * @returns {InstallationTokenMint} The token, or `unexpected` when missing or malformed.
 */
export function parseMintedToken(body: string | null): InstallationTokenMint {
  const { token, expires_at: expiresAt } = parseJsonObject(body);
  const expiry = typeof expiresAt === 'string' ? new Date(expiresAt) : null;

  if (typeof token !== 'string' || token === '' || expiry === null || Number.isNaN(expiry.getTime())) {
    return unexpected();
  }

  return { kind: 'ok', token: new Secret(token), expiresAt: expiry };
}

/**
 * Maps the statuses that are not a rate limit.
 * @param {RepoOperation} operation - The operation that was called.
 * @param {number} status - The HTTP status.
 * @param {boolean} authenticated - Whether the call carried a credential.
 * @returns {RepoClassification} The classification.
 */
function classifyStatus(operation: RepoOperation, status: number, authenticated: boolean): RepoClassification {
  if (status === 304) {
    return operation === 'repository' ? unexpected() : { kind: 'not_modified' };
  }

  if (status === 401) {
    return authenticated ? { kind: 'invalid_credentials' } : unexpected();
  }

  if (status === 403) {
    return operation === 'repository' ? { kind: 'not_found' } : { kind: 'unavailable', reason: 'forbidden' };
  }

  if (status === 404) {
    return operation === 'repository' || operation === 'handle_repos' ? { kind: 'not_found' } : unexpected();
  }

  return classifyRange(status);
}

/**
 * Maps a status by its range: `3xx` → `redirect`, `5xx` → `server_error`, else `unexpected`.
 * @param {number} status - The HTTP status.
 * @returns {UnavailableResult} The classification.
 */
export function classifyRange(status: number): UnavailableResult {
  if (status >= 300 && status < 400) {
    return { kind: 'unavailable', reason: 'redirect' };
  }

  return status >= 500 ? { kind: 'unavailable', reason: 'server_error' } : unexpected();
}

/**
 * @returns {UnavailableResult} `unavailable` (`unexpected`).
 */
export function unexpected(): UnavailableResult {
  return { kind: 'unavailable', reason: 'unexpected' };
}

/**
 * Parses a JSON array body.
 * @param {string | null} body - The body text, or `null` when over the cap.
 * @returns {unknown} The array, or `null` when absent, unparseable or not an array.
 */
function parseJsonArray(body: string | null): unknown {
  if (body === null) {
    return null;
  }

  try {
    const parsed: unknown = JSON.parse(body);

    return Array.isArray(parsed) ? parsed : null;
  } catch {
    return null;
  }
}

/**
 * Whether a value is a GitHub id: a positive integer below 2⁵³.
 * @param {unknown} value - The value.
 * @returns {boolean} Whether it is one.
 */
function isGithubId(value: unknown): value is number {
  return typeof value === 'number' && Number.isSafeInteger(value) && value > 0;
}

/**
 * Whether a value is a non-empty string of at most `max` characters.
 * @param {unknown} value - The value.
 * @param {number} max - The longest accepted length.
 * @returns {boolean} Whether it is one.
 */
function isBoundedString(value: unknown, max: number): value is string {
  return typeof value === 'string' && value !== '' && value.length <= max;
}

/**
 * Narrows a value to a plain object.
 * @param {unknown} value - The value.
 * @returns {Record<string, unknown>} The object, or `{}`.
 */
function asObject(value: unknown): Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value) ? value as Record<string, unknown> : {};
}
