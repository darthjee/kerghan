import type { GithubCase, GithubOperation } from './github-builders.js';
import { jsonResponse, rateLimitHeaders, rawIssue } from './github-raw.js';
import type { GithubIssue, GithubIssueRepo, RenamedTo } from '../../github-issue-results.js';

/**
 * The typed builders of the issue operations (`getIssue`, `probeIssues`,
 * `updateIssue`), part of the shared GitHub builders (`github-builders.ts`
 * re-exports them). Each case gives the raw `fetch` answer and the typed
 * result the real service answers for it, which `FakeIntegrationsGithubService`
 * returns for the same case. There is no recorded JSON: the raw bodies are
 * built from the typed shapes (`rawIssue`).
 */

// Default ids sit above 2³¹, so a 32-bit truncation anywhere shows up.
const DEFAULT_ID_BASE = 2 ** 31 + 5000;

let nextIssue = 0;

/**
 * Builds an issue, with an id above 2³¹ by default.
 * @param {Partial<GithubIssue>} attributes - Overrides.
 * @returns {GithubIssue} The issue.
 */
export function githubIssue(attributes: Partial<GithubIssue> = {}): GithubIssue {
  nextIssue += 1;

  return {
    id: attributes.id ?? DEFAULT_ID_BASE + nextIssue,
    number: attributes.number ?? nextIssue,
    title: attributes.title ?? `Issue ${nextIssue}`,
    body: attributes.body === undefined ? `Body of issue ${nextIssue}` : attributes.body,
    state: attributes.state ?? 'open',
    updatedAt: attributes.updatedAt ?? new Date('2026-01-01T00:00:00Z'),
    isPullRequest: attributes.isPullRequest ?? false,
  };
}

/**
 * Builds a pull request: an issue whose raw body carries a `pull_request` member (E3).
 * @param {Partial<GithubIssue>} attributes - Overrides.
 * @returns {GithubIssue} The pull request, with `isPullRequest: true`.
 */
export function githubPullRequest(attributes: Partial<GithubIssue> = {}): GithubIssue {
  return githubIssue({ ...attributes, isPullRequest: true });
}

/**
 * `GET`/`PATCH` of an issue answering `200` with the raw issue and its `ETag`.
 * @param {GithubIssue} githubIssueValue - The issue.
 * @param {{ etag?: string | null }} [options] - The `ETag` (`null` for none).
 * @returns {GithubCase} The case.
 */
export function issue(githubIssueValue: GithubIssue, options: { etag?: string | null } = {}): GithubCase {
  const etag = etagOf(githubIssueValue, options);

  return {
    name: `issue(${githubIssueValue.number})`,
    raw: () => jsonResponse(200, rawIssue(githubIssueValue), etagHeaders(etag)),
    resultFor: (operation) => {
      if (operation === 'getIssue') {
        return { kind: 'ok', issue: githubIssueValue, etag };
      }

      if (operation === 'updateIssue') {
        return { kind: 'ok', issue: githubIssueValue };
      }

      throw new Error('issue() is a getIssue or updateIssue case');
    },
  };
}

/**
 * The probe's `200`: a listing of (at most one) issue.
 * @param {GithubIssue[]} issues - The listed issues (their content is irrelevant to the probe).
 * @returns {GithubCase} The case.
 */
export function issuePage(issues: GithubIssue[]): GithubCase {
  return {
    name: `issuePage(${issues.length} issues)`,
    raw: () => jsonResponse(200, issues.map((entry) => rawIssue(entry))),
    resultFor: (operation) => {
      if (operation !== 'probeIssues') {
        throw new Error('issuePage() is a probeIssues case');
      }

      return { kind: 'ok' };
    },
  };
}

/**
 * A `410` (a deleted issue GitHub still remembers).
 * @returns {GithubCase} The case.
 */
export function issueGone(): GithubCase {
  return {
    name: 'issueGone()',
    raw: () => jsonResponse(410, { message: 'This issue was deleted CANARYcanaryBODY' }),
    resultFor: (operation) => {
      assertIssueOperation('issueGone()', operation);

      return operation === 'probeIssues' ? { kind: 'unavailable', reason: 'unexpected' } : { kind: 'gone' };
    },
  };
}

/**
 * A repository rename: a `301` to `/repositories/{id}/issues/{n}`, followed by the `200`.
 * It is a two-answer case (a sequence).
 * @param {GithubIssueRepo} repo - The repository the call targets.
 * @param {number} number - The issue number the call targets.
 * @param {GithubIssue} githubIssueValue - The issue the followed answer carries.
 * @param {RenamedTo} renamedTo - The repository's new names (the followed answer's `repository_url`).
 * @param {{ etag?: string | null }} [options] - The followed answer's `ETag` (`null` for none).
 * @returns {GithubCase} The case.
 */
export function issueRenamed(
  repo: GithubIssueRepo,
  number: number,
  githubIssueValue: GithubIssue,
  renamedTo: RenamedTo,
  options: { etag?: string | null } = {},
): GithubCase {
  const etag = etagOf(githubIssueValue, options);
  const location = `https://api.github.com/repositories/${repo.githubId}/issues/${number}`;

  return {
    name: `issueRenamed(${repo.githubId}, ${number})`,
    raw: {
      sequence: [
        () => new Response(null, { status: 301, headers: rateLimitHeaders({ location }) }),
        () => jsonResponse(200, rawIssue(githubIssueValue, renamedTo), etagHeaders(etag)),
      ],
    },
    resultFor: (operation) => {
      if (operation === 'getIssue') {
        return { kind: 'ok', issue: githubIssueValue, etag, renamedTo };
      }

      if (operation === 'updateIssue') {
        return { kind: 'ok', issue: githubIssueValue, renamedTo };
      }

      throw new Error('issueRenamed() is a getIssue or updateIssue case');
    },
  };
}

/**
 * A `301` to another `api.github.com` path (a transferred issue, E2/E65). It is not
 * followed; the probe sees it as a redirect.
 * @param {string} [location] - The `Location` (must not be the rename form of the repository and number).
 * @returns {GithubCase} The case.
 */
export function issueMoved(location: string = 'https://api.github.com/repositories/1/issues/1'): GithubCase {
  return {
    name: 'issueMoved()',
    raw: () => new Response(null, { status: 301, headers: rateLimitHeaders({ location }) }),
    resultFor: (operation) => {
      assertIssueOperation('issueMoved()', operation);

      return operation === 'probeIssues' ? { kind: 'unavailable', reason: 'redirect' } : { kind: 'moved' };
    },
  };
}

/**
 * A `301` to another host, scheme or port. It is never followed and no credential is sent there.
 * @param {string} [location] - The `Location`.
 * @returns {GithubCase} The case.
 */
export function issueRedirectOffHost(location: string = 'https://evil.example/repositories/1/issues/1'): GithubCase {
  return {
    name: 'issueRedirectOffHost()',
    raw: () => new Response(null, { status: 301, headers: rateLimitHeaders({ location }) }),
    resultFor: (operation) => {
      assertIssueOperation('issueRedirectOffHost()', operation);

      return { kind: 'unavailable', reason: 'redirect' };
    },
  };
}

/**
 * The `ETag` of a case: the option, or one derived from the issue id.
 * @param {GithubIssue} value - The issue.
 * @param {{ etag?: string | null }} options - The option.
 * @returns {string | null} The `ETag`.
 */
function etagOf(value: GithubIssue, options: { etag?: string | null }): string | null {
  return options.etag === undefined ? `W/"issue-${value.id}"` : options.etag;
}

/**
 * @param {string | null} etag - The `ETag`.
 * @returns {Record<string, string>} The header, or none.
 */
function etagHeaders(etag: string | null): Record<string, string> {
  return etag === null ? {} : { etag };
}

/**
 * @param {string} name - The builder, for the message.
 * @param {GithubOperation} operation - The operation.
 * @returns {void}
 */
function assertIssueOperation(name: string, operation: GithubOperation): void {
  if (operation !== 'getIssue' && operation !== 'probeIssues' && operation !== 'updateIssue') {
    throw new Error(`${name} is an issue case`);
  }
}
