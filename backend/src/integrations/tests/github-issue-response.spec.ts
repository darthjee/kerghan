import { FakeClock } from '../../core/tests/support/fake-clock.js';
import type { GithubRateLimitFields } from '../github-http.js';
import {
  classifyIssueResponse,
  isIssueListing,
  ISSUE_BODY_MAX_BYTES,
  ISSUE_PROBE_BODY_MAX_BYTES,
  parseIssue,
  parseRenamedTo,
} from '../github-issue-response.js';
import type { RepoOperation } from '../github-repo-response.js';
import { githubIssue, githubPullRequest, rawIssue } from './support/github-builders.js';

const NOW = new Date('2026-01-01T00:00:00Z');
const NO_LIMIT: GithubRateLimitFields = { rateLimitRemaining: 4999, rateLimitReset: null, retryAfter: null };
const OPERATIONS: RepoOperation[] = ['issue', 'issue_probe', 'issue_update'];
const clock = new FakeClock(NOW);

/**
 * Classifies a status for an operation.
 * @param {RepoOperation} operation - The operation.
 * @param {number} status - The status.
 * @param {GithubRateLimitFields} [rateLimit] - The headers.
 * @param {boolean} [authenticated] - Whether a credential was sent.
 * @returns {ReturnType<typeof classifyIssueResponse>} The classification.
 */
function classify(
  operation: RepoOperation,
  status: number,
  rateLimit: GithubRateLimitFields = NO_LIMIT,
  authenticated: boolean = true,
): ReturnType<typeof classifyIssueResponse> {
  return classifyIssueResponse(operation, status, rateLimit, authenticated, clock);
}

describe('classifyIssueResponse', () => {
  it.each(OPERATIONS)('%s: a 200 is parsed next (null)', (operation) => {
    expect(classify(operation, 200)).toBeNull();
  });

  it.each(OPERATIONS)('%s: a primary rate limit is rate_limited with the reset', (operation) => {
    const limited = { rateLimitRemaining: 0, rateLimitReset: 1_767_229_200, retryAfter: null };

    expect(classify(operation, 403, limited)).toEqual({ kind: 'rate_limited', resetAt: new Date(1_767_229_200_000) });
    expect(classify(operation, 429, limited)).toEqual({ kind: 'rate_limited', resetAt: new Date(1_767_229_200_000) });
  });

  it.each(OPERATIONS)('%s: a secondary rate limit is rate_limited at now + Retry-After', (operation) => {
    const limited = { rateLimitRemaining: 10, rateLimitReset: null, retryAfter: 60 };

    expect(classify(operation, 403, limited)).toEqual({ kind: 'rate_limited', resetAt: new Date(NOW.getTime() + 60_000) });
  });

  it.each(OPERATIONS)('%s: a 403 that is not a rate limit is forbidden, its own kind', (operation) => {
    expect(classify(operation, 403)).toEqual({ kind: 'forbidden' });
  });

  it.each(OPERATIONS)('%s: 401 is invalid_credentials (unexpected without a credential)', (operation) => {
    expect(classify(operation, 401)).toEqual({ kind: 'invalid_credentials' });
    expect(classify(operation, 401, NO_LIMIT, false)).toEqual({ kind: 'unavailable', reason: 'unexpected' });
  });

  it.each(OPERATIONS)('%s: 404 is not_found', (operation) => {
    expect(classify(operation, 404)).toEqual({ kind: 'not_found' });
  });

  it('304 is not_modified for the issue read only', () => {
    expect(classify('issue', 304)).toEqual({ kind: 'not_modified' });
    expect(classify('issue_probe', 304)).toEqual({ kind: 'unavailable', reason: 'unexpected' });
    expect(classify('issue_update', 304)).toEqual({ kind: 'unavailable', reason: 'unexpected' });
  });

  it('410 is gone for the read and the write, unexpected for the probe', () => {
    expect(classify('issue', 410)).toEqual({ kind: 'gone' });
    expect(classify('issue_update', 410)).toEqual({ kind: 'gone' });
    expect(classify('issue_probe', 410)).toEqual({ kind: 'unavailable', reason: 'unexpected' });
  });

  it.each(OPERATIONS)('%s: a 422 is unavailable (unexpected)', (operation) => {
    expect(classify(operation, 422)).toEqual({ kind: 'unavailable', reason: 'unexpected' });
  });

  it.each(OPERATIONS)('%s: 5xx is server_error, a 3xx is redirect, the rest is unexpected', (operation) => {
    expect(classify(operation, 502)).toEqual({ kind: 'unavailable', reason: 'server_error' });
    expect(classify(operation, 301)).toEqual({ kind: 'unavailable', reason: 'redirect' });
    expect(classify(operation, 418)).toEqual({ kind: 'unavailable', reason: 'unexpected' });
  });
});

describe('parseIssue', () => {
  it('parses a valid issue, keeping only the model fields', () => {
    const issue = githubIssue({ number: 7, body: 'line 1\r\nline 2\r\n' });

    expect(parseIssue(rawIssue(issue))).toEqual(issue);
  });

  it('keeps a body verbatim, CRLF included', () => {
    expect(parseIssue(rawIssue(githubIssue({ body: 'a\r\n\r\nb ' })))?.body).toBe('a\r\n\r\nb ');
  });

  it.each([
    ['a missing body', undefined],
    ['a null body', null],
    ['an empty body', ''],
    ['a blank body', ' \r\n\t '],
  ])('%s becomes null', (_name, body) => {
    const raw = rawIssue(githubIssue());

    if (body === undefined) {
      delete raw.body;
    } else {
      raw.body = body;
    }

    expect(parseIssue(raw)?.body).toBeNull();
  });

  it('marks a pull request by its pull_request member (a falsy-looking one included)', () => {
    expect(parseIssue(rawIssue(githubPullRequest()))?.isPullRequest).toBe(true);
    expect(parseIssue({ ...rawIssue(githubIssue()), pull_request: null })?.isPullRequest).toBe(true);
    expect(parseIssue(rawIssue(githubIssue()))?.isPullRequest).toBe(false);
  });

  it('accepts the limits: a 256-character title and a 65536-character body', () => {
    const issue = githubIssue({ title: 't'.repeat(256), body: 'b'.repeat(65536) });

    expect(parseIssue(rawIssue(issue))).toEqual(issue);
  });

  it.each([
    ['a title over 256 characters', { title: 't'.repeat(257) }],
    ['a body over 65536 characters', { body: 'b'.repeat(65537) }],
    ['a non-string title', { title: 5 }],
    ['a non-string body', { body: 5 }],
    ['an unknown state', { state: 'merged' }],
    ['no state', { state: undefined }],
    ['a zero id', { id: 0 }],
    ['an unsafe id', { id: 2 ** 53 }],
    ['a fractional number', { number: 1.5 }],
    ['a string number', { number: '7' }],
    ['a bad updated_at', { updated_at: 'yesterday' }],
    ['no updated_at', { updated_at: undefined }],
  ])('is null for %s', (_name, override) => {
    expect(parseIssue({ ...rawIssue(githubIssue()), ...override })).toBeNull();
  });

  it.each([[null], [[]], ['issue'], [5]])('is null for %j', (raw) => {
    expect(parseIssue(raw)).toBeNull();
  });

  it('sizes the body caps to fit the limits', () => {
    // 65536 characters can take 4 bytes each in UTF-8.
    expect(ISSUE_BODY_MAX_BYTES).toBeGreaterThanOrEqual(65536 * 4);
    expect(ISSUE_PROBE_BODY_MAX_BYTES).toBe(64 * 1024);
  });
});

describe('parseRenamedTo', () => {
  it('reads owner and name from repository_url', () => {
    expect(parseRenamedTo({ repository_url: 'https://api.github.com/repos/new-org/gadgets' })).toEqual({ owner: 'new-org', name: 'gadgets' });
  });

  it('URL-decodes the parts', () => {
    expect(parseRenamedTo({ repository_url: 'https://api.github.com/repos/new%2Dorg/ga%20dgets' })).toEqual({ owner: 'new-org', name: 'ga dgets' });
  });

  it.each([
    ['another host', 'https://evil.example/repos/o/n'],
    ['another scheme', 'http://api.github.com/repos/o/n'],
    ['another port', 'https://api.github.com:8443/repos/o/n'],
    ['another path', 'https://api.github.com/repositories/1'],
    ['a longer path', 'https://api.github.com/repos/o/n/issues'],
    ['a missing name', 'https://api.github.com/repos/o/'],
    ['a query', 'https://api.github.com/repos/o/n?x=1'],
    ['a malformed escape', 'https://api.github.com/repos/%E0%A4%A/n'],
    ['an over-long owner', `https://api.github.com/repos/${'o'.repeat(40)}/n`],
    ['an over-long name', `https://api.github.com/repos/o/${'n'.repeat(101)}`],
    ['an empty decoded part', 'https://api.github.com/repos//n'],
  ])('is null for %s', (_name, repositoryUrl) => {
    expect(parseRenamedTo({ repository_url: repositoryUrl })).toBeNull();
  });

  it('accepts the longest owner and name', () => {
    expect(parseRenamedTo({ repository_url: `https://api.github.com/repos/${'o'.repeat(39)}/${'n'.repeat(100)}` }))
      .toEqual({ owner: 'o'.repeat(39), name: 'n'.repeat(100) });
  });

  it.each([[{}], [{ repository_url: 5 }], [null], ['x']])('is null for %j', (raw) => {
    expect(parseRenamedTo(raw)).toBeNull();
  });
});

describe('isIssueListing', () => {
  it.each([['[]'], ['[1, "x", null]'], ['[{"id": 1}]']])('accepts the array %s whatever its content', (body) => {
    expect(isIssueListing(body)).toBe(true);
  });

  it.each([['{}'], ['"x"'], ['null'], ['not json'], [null]])('rejects %s', (body) => {
    expect(isIssueListing(body)).toBe(false);
  });
});
