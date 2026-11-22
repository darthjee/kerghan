/**
 * The pure half of the issue client, mirroring `github-repo-response.ts`: the
 * status classification and the body parsing of `getIssue`, `probeIssues` and
 * `updateIssue`. Rate limits are read from headers only; no body is parsed for
 * a message. A `3xx` is handled by `github-issue-redirect.ts` before it gets here.
 */
import type { GithubRateLimitFields } from './github-http.js';
import type { GithubIssue, IssueFailure, RenamedTo } from './github-issue-results.js';
import {
  asObject,
  classifyRange,
  isBoundedString,
  isGithubId,
  isRateLimitAnswer,
  NAME_MAX_LENGTH,
  OWNER_MAX_LENGTH,
  type RepoOperation,
  resetAtFor,
  unexpected,
} from './github-repo-response.js';
import type { RepoFailure } from './github-repo-results.js';
import type { Clock } from '../core/clock.js';

/**
 * The largest issue body accepted: a 65536-character issue body takes up to 4
 * bytes per character in UTF-8, and JSON escaping and the metadata come on top.
 */
export const ISSUE_BODY_MAX_BYTES = 512 * 1024;

/** The largest probe body accepted. */
export const ISSUE_PROBE_BODY_MAX_BYTES = 64 * 1024;

/** What a non-`200` issue answer classifies as. */
export type IssueClassification =
  | { kind: 'not_modified' }
  | IssueFailure
  | RepoFailure;

// Longest issue title GitHub accepts.
const TITLE_MAX_LENGTH = 256;
// Longest issue body GitHub accepts.
const BODY_MAX_LENGTH = 65536;
// `https://api.github.com/repos/{owner}/{name}`, nothing else.
const REPOSITORY_URL = /^https:\/\/api\.github\.com\/repos\/([^/?#]+)\/([^/?#]+)$/;

/**
 * Classifies an issue answer by its status and rate-limit headers.
 * @param {RepoOperation} operation - `issue`, `issue_probe` or `issue_update`.
 * @param {number} status - The HTTP status.
 * @param {GithubRateLimitFields} rateLimit - The normalised rate-limit headers.
 * @param {boolean} authenticated - Whether the call carried a credential.
 * @param {Clock} clock - The time source, for `now + Retry-After`.
 * @returns {IssueClassification | null} The classification, or `null` for a `200`.
 */
export function classifyIssueResponse(
  operation: RepoOperation,
  status: number,
  rateLimit: GithubRateLimitFields,
  authenticated: boolean,
  clock: Clock,
): IssueClassification | null {
  if (status === 200) {
    return null;
  }

  if (isRateLimitAnswer(status, rateLimit)) {
    return { kind: 'rate_limited', resetAt: resetAtFor(rateLimit, clock) };
  }

  return classifyIssueStatus(operation, status, authenticated);
}

/**
 * Parses one issue object, keeping only the model's fields.
 * @param {unknown} raw - The parsed JSON.
 * @returns {GithubIssue | null} The issue, or `null` when malformed.
 */
export function parseIssue(raw: unknown): GithubIssue | null {
  const entry = asObject(raw);
  const { id, number, title, state } = entry;
  const body = parseBody(entry.body);
  const updatedAt = parseDate(entry.updated_at);

  if (!isGithubId(id) || !isGithubId(number) || !isTitle(title) || body === undefined || !isState(state) || updatedAt === null) {
    return null;
  }

  return { id, number, title, body, state, updatedAt, isPullRequest: entry.pull_request !== undefined };
}

/**
 * Reads the new owner and name from a followed answer's `repository_url`.
 * @param {unknown} raw - The parsed JSON of the followed answer.
 * @returns {RenamedTo | null} The names, or `null` when missing or malformed.
 */
export function parseRenamedTo(raw: unknown): RenamedTo | null {
  const url = asObject(raw).repository_url;
  const match = typeof url === 'string' ? REPOSITORY_URL.exec(url) : null;

  if (match === null) {
    return null;
  }

  const owner = decode(match[1]);
  const name = decode(match[2]);

  if (!isBoundedString(owner, OWNER_MAX_LENGTH) || !isBoundedString(name, NAME_MAX_LENGTH)) {
    return null;
  }

  return { owner, name };
}

/**
 * Whether the probe's `200` body is a JSON array (whatever its content).
 * @param {string | null} body - The body text, or `null` when over the cap.
 * @returns {boolean} `true` for an array.
 */
export function isIssueListing(body: string | null): boolean {
  if (body === null) {
    return false;
  }

  try {
    return Array.isArray(JSON.parse(body));
  } catch {
    return false;
  }
}

/**
 * Maps the statuses that are not a rate limit.
 * @param {RepoOperation} operation - The operation that was called.
 * @param {number} status - The HTTP status.
 * @param {boolean} authenticated - Whether the call carried a credential.
 * @returns {IssueClassification} The classification.
 */
function classifyIssueStatus(operation: RepoOperation, status: number, authenticated: boolean): IssueClassification {
  switch (status) {
    case 304:
      return operation === 'issue' ? { kind: 'not_modified' } : unexpected();
    case 401:
      return authenticated ? { kind: 'invalid_credentials' } : unexpected();
    case 403:
      return { kind: 'forbidden' };
    case 404:
      return { kind: 'not_found' };
    case 410:
      return operation === 'issue_probe' ? unexpected() : { kind: 'gone' };
    default:
    // 422 on the write is unexpected too: the allowlisted body never triggers it.
      return classifyRange(status);
  }
}

/**
 * @param {unknown} value - The value.
 * @returns {boolean} Whether it is an issue title: a string of at most 256 characters.
 */
function isTitle(value: unknown): value is string {
  return typeof value === 'string' && value.length <= TITLE_MAX_LENGTH;
}

/**
 * @param {unknown} value - The value.
 * @returns {boolean} Whether it is an issue state.
 */
function isState(value: unknown): value is 'open' | 'closed' {
  return value === 'open' || value === 'closed';
}

/**
 * @param {unknown} value - The value.
 * @returns {Date | null} The date, or `null` when it is not a valid ISO date string.
 */
function parseDate(value: unknown): Date | null {
  const date = typeof value === 'string' ? new Date(value) : null;

  return date === null || Number.isNaN(date.getTime()) ? null : date;
}

/**
 * Normalises an issue body: a missing or blank body is `null`.
 * @param {unknown} raw - The `body` member.
 * @returns {string | null | undefined} The body, `null` when missing or blank, `undefined` when malformed.
 */
function parseBody(raw: unknown): string | null | undefined {
  if (raw === undefined || raw === null) {
    return null;
  }

  if (typeof raw !== 'string' || raw.length > BODY_MAX_LENGTH) {
    return undefined;
  }

  return raw.trim() === '' ? null : raw;
}

/**
 * URL-decodes a path part.
 * @param {string} part - The encoded part.
 * @returns {string} The decoded part, or `''` when malformed.
 */
function decode(part: string): string {
  try {
    return decodeURIComponent(part);
  } catch {
    return '';
  }
}
