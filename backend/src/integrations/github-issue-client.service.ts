import { Injectable } from '@nestjs/common';
import { apiHeaders, GITHUB_API_URL, GithubClientError, send } from './github-client.service.js';
import { parseJsonObject, rateLimitFields } from './github-http.js';
import { classifyIssueRedirect, isIssueRedirectStatus } from './github-issue-redirect.js';
import {
  classifyIssueResponse,
  ISSUE_BODY_MAX_BYTES,
  ISSUE_PROBE_BODY_MAX_BYTES,
  isIssueListing,
  parseIssue,
  parseRenamedTo,
} from './github-issue-response.js';
import type {
  GithubIssueChanges,
  GithubIssueRepo,
  IssueProbeResult,
  IssueResult,
  IssueUpdateResult,
} from './github-issue-results.js';
import type { RepoCall } from './github-repo-client.service.js';
import { type RepoOperation, unexpected } from './github-repo-response.js';
import type { UnavailableReason } from './github-repo-results.js';
import type { Secret } from './secret.js';
import { Clock } from '../core/clock.js';

/** One issue call: what is sent and how a `200` is read. */
interface IssueRequest<T> {
  operation: RepoOperation;
  method: 'GET' | 'PATCH';
  repo: GithubIssueRepo;
  number: number;
  path: string;
  headers: Record<string, string>;
  body?: string;
  maxBodyBytes: number;
  onOk: (body: string, response: Response) => T;
}

type Answer = { response: Response; body: string | null };

// The only fields a write may send.
const CHANGE_FIELDS: ReadonlySet<string> = new Set(['title', 'body', 'state']);

/**
 * The fixed issue operations (two `GET`s and the one allowlisted `PATCH`).
 * Internal to the Integrations module (never exported): only
 * `IntegrationsGithubService` and `IntegrationsGithubIssueWriter` call it.
 *
 * Every call targets `https://api.github.com` through `send` (timeout, body
 * cap), with `redirect: 'manual'`. A rename redirect is followed once, at a
 * URL rebuilt from the repository id and the issue number; any other
 * redirect is never followed, so a credential is sent to no other URL.
 */
@Injectable()
export class GithubIssueClientService {
  /**
   * @param {Clock} clock - The time source, for `now + Retry-After`.
   */
  constructor(private readonly clock: Clock) {}

  /**
   * `GET /repos/{owner}/{name}/issues/{number}`.
   * @param {Secret<string>} token - The credential.
   * @param {GithubIssueRepo} repo - The repository.
   * @param {number} number - The issue number.
   * @param {string | null} [etag] - The stored ETag, sent as `If-None-Match`.
   * @returns {Promise<RepoCall<IssueResult>>} The typed result.
   */
  async getIssue(token: Secret<string>, repo: GithubIssueRepo, number: number, etag?: string | null): Promise<RepoCall<IssueResult>> {
    const headers = apiHeaders(`Bearer ${token.reveal()}`);

    return await this.#call({
      operation: 'issue',
      method: 'GET',
      repo,
      number,
      path: issuePath(repo, number),
      headers: etag === undefined || etag === null ? headers : { ...headers, 'If-None-Match': etag },
      maxBodyBytes: ISSUE_BODY_MAX_BYTES,
      onOk: (body, response): IssueResult => {
        const issue = parseIssue(parseJsonObject(body));

        return issue === null ? unexpected() : { kind: 'ok', issue, etag: response.headers.get('etag') };
      },
    });
  }

  /**
   * `GET /repos/{owner}/{name}/issues?per_page=1`.
   * @param {Secret<string>} token - The credential.
   * @param {GithubIssueRepo} repo - The repository.
   * @returns {Promise<RepoCall<IssueProbeResult>>} The typed result.
   */
  async probeIssues(token: Secret<string>, repo: GithubIssueRepo): Promise<RepoCall<IssueProbeResult>> {
    return await this.#call({
      operation: 'issue_probe',
      method: 'GET',
      repo,
      number: 0,
      path: `${repoPath(repo)}/issues?per_page=1`,
      headers: apiHeaders(`Bearer ${token.reveal()}`),
      maxBodyBytes: ISSUE_PROBE_BODY_MAX_BYTES,
      onOk: (body): IssueProbeResult => (isIssueListing(body) ? { kind: 'ok' } : unexpected()),
    });
  }

  /**
   * `PATCH /repos/{owner}/{name}/issues/{number}` with the allowlisted diff.
   * @param {Secret<string>} token - The credential.
   * @param {GithubIssueRepo} repo - The repository.
   * @param {number} number - The issue number.
   * @param {GithubIssueChanges} changes - The diff: `title`, `body` and `state` only.
   * @returns {Promise<RepoCall<IssueUpdateResult>>} The typed result.
   */
  async updateIssue(
    token: Secret<string>,
    repo: GithubIssueRepo,
    number: number,
    changes: GithubIssueChanges,
  ): Promise<RepoCall<IssueUpdateResult>> {
    const body = JSON.stringify(allowlistedBody(changes));

    return await this.#call({
      operation: 'issue_update',
      method: 'PATCH',
      repo,
      number,
      path: issuePath(repo, number),
      headers: { ...apiHeaders(`Bearer ${token.reveal()}`), 'Content-Type': 'application/json' },
      body,
      maxBodyBytes: ISSUE_BODY_MAX_BYTES,
      onOk: (text): IssueUpdateResult => {
        const issue = parseIssue(parseJsonObject(text));

        return issue === null ? unexpected() : { kind: 'ok', issue };
      },
    });
  }

  /**
   * Sends one issue request, follows a rename once, and classifies the answer.
   * @param {IssueRequest<T>} request - The request.
   * @returns {Promise<RepoCall<T>>} The typed result, the rate-limit headers and the status.
   */
  async #call<T extends IssueResult | IssueUpdateResult | IssueProbeResult>(request: IssueRequest<T>): Promise<RepoCall<T>> {
    try {
      const first = await sendIssue(`${GITHUB_API_URL}${request.path}`, request);

      if (!isIssueRedirectStatus(first.response.status)) {
        return this.#interpret(request, first, false);
      }

      return await this.#redirected(request, first);
    } catch (error) {
      return { result: { kind: 'unavailable', reason: clientErrorReason(error) } as T, rateLimit: null, status: null };
    }
  }

  /**
   * Handles a redirect: a rename is retried once, a transfer is `moved`,
   * anything else is `unavailable{redirect}` and never followed.
   * @param {IssueRequest<T>} request - The request.
   * @param {Answer} first - The redirect answer.
   * @returns {Promise<RepoCall<T>>} The typed result.
   */
  async #redirected<T extends IssueResult | IssueUpdateResult | IssueProbeResult>(
    request: IssueRequest<T>,
    first: Answer,
  ): Promise<RepoCall<T>> {
    const { status } = first.response;
    const rateLimit = rateLimitFields(first.response.headers);

    if (request.operation === 'issue_probe') {
      return { result: redirectUnavailable() as T, rateLimit, status };
    }

    const redirect = classifyIssueRedirect(first.response.headers.get('location'), request.repo, request.number);

    if (redirect.kind === 'moved') {
      return { result: { kind: 'moved' } as T, rateLimit, status };
    }

    if (redirect.kind === 'unclassifiable') {
      return { result: redirectUnavailable() as T, rateLimit, status };
    }

    const second = await sendIssue(redirect.url, request);

    if (isIssueRedirectStatus(second.response.status)) {
      return { result: redirectUnavailable() as T, rateLimit: rateLimitFields(second.response.headers), status: second.response.status };
    }

    return this.#interpret(request, second, true);
  }

  /**
   * Classifies an answer; a `200` is parsed, and carries `renamedTo` after a followed rename.
   * @param {IssueRequest<T>} request - The request.
   * @param {Answer} answer - The final answer.
   * @param {boolean} renamed - Whether a rename redirect was followed.
   * @returns {RepoCall<T>} The typed result.
   */
  #interpret<T extends IssueResult | IssueUpdateResult | IssueProbeResult>(
    request: IssueRequest<T>,
    answer: Answer,
    renamed: boolean,
  ): RepoCall<T> {
    const { response, body } = answer;
    const rateLimit = rateLimitFields(response.headers);
    const classified = classifyIssueResponse(request.operation, response.status, rateLimit, true, this.clock);
    const base = { rateLimit, status: response.status };

    if (classified !== null) {
      return { result: classified as T, ...base };
    }

    if (body === null) {
      return { result: unexpected() as T, ...base };
    }

    const result = request.onOk(body, response);

    return { result: renamed ? withRenamedTo(result, body) : result, ...base };
  }
}

/**
 * Sends the request to a URL on `api.github.com`; a redirect is never followed by `fetch`.
 * @param {string} url - The URL built from `GITHUB_API_URL`.
 * @param {IssueRequest<unknown>} request - The method, headers and body.
 * @returns {Promise<Answer>} The response and its capped body.
 */
function sendIssue(url: string, request: IssueRequest<unknown>): Promise<Answer> {
  const init: RequestInit = { method: request.method, headers: request.headers };

  if (request.body !== undefined) {
    init.body = request.body;
  }

  return send(url, init, request.maxBodyBytes, { redirect: 'manual' });
}

/**
 * Adds `renamedTo`, parsed from the followed answer's `repository_url`, to an `ok` result.
 * @param {T} result - The parsed result.
 * @param {string} body - The followed answer's body.
 * @returns {T} The result with `renamedTo`, or `unavailable{unexpected}` when it cannot be parsed.
 */
function withRenamedTo<T extends IssueResult | IssueUpdateResult | IssueProbeResult>(result: T, body: string): T {
  if (result.kind !== 'ok') {
    return result;
  }

  const renamedTo = parseRenamedTo(parseJsonObject(body));

  return renamedTo === null ? unexpected() as T : { ...result, renamedTo };
}

/**
 * @returns {{ kind: 'unavailable', reason: 'redirect' }} The result of a redirect that was not followed.
 */
function redirectUnavailable(): { kind: 'unavailable'; reason: UnavailableReason } {
  return { kind: 'unavailable', reason: 'redirect' };
}

/**
 * `/repos/{owner}/{name}`, each part URL-encoded.
 * @param {GithubIssueRepo} repo - The repository.
 * @returns {string} The path.
 */
function repoPath(repo: GithubIssueRepo): string {
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
function issuePath(repo: GithubIssueRepo, number: number): string {
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
function allowlistedBody(changes: GithubIssueChanges): Record<string, unknown> {
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

/**
 * The `unavailable` reason of a failure without an HTTP answer.
 * @param {unknown} error - What `send` threw.
 * @returns {UnavailableReason} `timeout` / `network_error`.
 */
function clientErrorReason(error: unknown): UnavailableReason {
  if (error instanceof GithubClientError) {
    return error.reason;
  }

  throw error;
}
