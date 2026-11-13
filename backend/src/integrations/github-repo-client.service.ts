import { Injectable } from '@nestjs/common';
import { apiHeaders, GITHUB_API_URL, GITHUB_API_VERSION, GITHUB_USER_AGENT, GithubClientError, send } from './github-client.service.js';
import { hasNextLink, parseJsonObject, rateLimitFields } from './github-http.js';
import {
  classifyRange,
  classifyRepoResponse,
  isRateLimitAnswer,
  parseRepo,
  parseMintedToken,
  parseRepoListing,
  type InstallationTokenMint,
  type RepoOperation,
  resetAtFor,
  unexpected,
} from './github-repo-response.js';
import type { RateLimitFields, RepoPageResult, RepoResult, UnavailableReason } from './github-repo-results.js';
import type { Secret } from './secret.js';
import { Clock } from '../core/clock.js';

// Largest repo listing body read: a page of 100 repo objects is ~0.5–1 MB.
export const GITHUB_REPO_LISTING_MAX_BODY_BYTES = 2 * 1024 * 1024;
// Largest `GET /repositories/{id}` body read.
export const GITHUB_REPO_MAX_BODY_BYTES = 64 * 1024;
// Repos per listing page.
export const GITHUB_REPOS_PER_PAGE = 100;
// The only permission repo calls mint an installation token with.
export const INSTALLATION_TOKEN_PERMISSIONS = { metadata: 'read' } as const;

// The fixed listing paths and their fixed parameters (the page is appended by the client).
const USER_REPOS_PATH = '/user/repos?affiliation=owner,collaborator,organization_member&visibility=all&sort=created&direction=asc';
const INSTALLATION_REPOS_PATH = '/installation/repositories';
const HANDLE_REPOS_QUERY = 'type=owner&sort=created&direction=asc';

// The mint statuses with their own meaning (the rest map by range).
const MINT_FAILURES = new Map<number, InstallationTokenMint>([
  [401, { kind: 'jwt_rejected' }],
  [403, { kind: 'suspended' }],
  [404, { kind: 'uninstalled' }],
]);

/**
 * A repo call's typed result, plus the rate-limit headers of GitHub's answer
 * (`null` when there was no HTTP answer), which the unauthenticated budget
 * tracker records. Internal to the module.
 */
export interface RepoCall<T> {
  result: T;
  rateLimit: RateLimitFields | null;
}

/**
 * The fixed, `GET`-only repo operations, plus the installation-token mint.
 * Internal to the Integrations module (never exported): only
 * `IntegrationsGithubService` calls it.
 *
 * Every call targets `https://api.github.com` through `send` (timeout, body
 * cap), with `redirect: 'manual'`, so a `3xx` is classified and never
 * followed. Page URLs are built here from `page`; a `Link` header is read only
 * for whether `rel="next"` exists. Without a token, no `Authorization` header
 * is sent.
 */
@Injectable()
export class GithubRepoClientService {
  /**
   * @param {Clock} clock - The time source, for `now + Retry-After`.
   */
  constructor(private readonly clock: Clock) {}

  /**
   * `GET /user/repos` (for `pat` and `oauth_app`), oldest first.
   * @param {Secret<string>} token - The user's token.
   * @param {number} page - The 1-based page number.
   * @param {string | null} [etag] - The stored ETag, sent as `If-None-Match`.
   * @returns {Promise<RepoCall<RepoPageResult>>} The typed page.
   */
  listUserRepos(token: Secret<string>, page: number, etag?: string | null): Promise<RepoCall<RepoPageResult>> {
    return this.#listing('user_repos', `${USER_REPOS_PATH}&${pageQuery(page)}`, token, etag);
  }

  /**
   * `GET /installation/repositories` (for `github_app`), with an installation token.
   * @param {Secret<string>} token - The installation token.
   * @param {number} page - The 1-based page number.
   * @param {string | null} [etag] - The stored ETag, sent as `If-None-Match`.
   * @returns {Promise<RepoCall<RepoPageResult>>} The typed page.
   */
  listInstallationRepos(token: Secret<string>, page: number, etag?: string | null): Promise<RepoCall<RepoPageResult>> {
    return this.#listing('installation_repos', `${INSTALLATION_REPOS_PATH}?${pageQuery(page)}`, token, etag);
  }

  /**
   * `GET /users/{handle}/repos?type=owner`, oldest first; the handle is URL-encoded.
   * @param {Secret<string> | null} token - The credential, or `null` for an unauthenticated call.
   * @param {string} handle - The GitHub handle.
   * @param {number} page - The 1-based page number.
   * @param {string | null} [etag] - The stored ETag, sent as `If-None-Match`.
   * @returns {Promise<RepoCall<RepoPageResult>>} The typed page.
   */
  listHandleRepos(
    token: Secret<string> | null,
    handle: string,
    page: number,
    etag?: string | null,
  ): Promise<RepoCall<RepoPageResult>> {
    const path = `/users/${encodeURIComponent(handle)}/repos?${HANDLE_REPOS_QUERY}&${pageQuery(page)}`;

    return this.#listing('handle_repos', path, token, etag);
  }

  /**
   * `GET /repositories/{githubId}`.
   * @param {Secret<string> | null} token - The credential, or `null` for an unauthenticated call.
   * @param {number} githubId - The repository id.
   * @returns {Promise<RepoCall<RepoResult>>} The typed repo.
   */
  async getRepositoryById(token: Secret<string> | null, githubId: number): Promise<RepoCall<RepoResult>> {
    if (!Number.isSafeInteger(githubId) || githubId <= 0) {
      throw new RangeError('githubId must be a positive integer');
    }

    return this.#call('repository', `/repositories/${githubId}`, token, null, GITHUB_REPO_MAX_BODY_BYTES, (body) => {
      const repo = parseRepo(parseJsonObject(body));

      return repo === null ? unexpected() : { kind: 'ok', repo };
    });
  }

  /**
   * `POST /app/installations/{id}/access_tokens` with the app JWT, asking for
   * `metadata: read` only. The token is parsed into a `Secret` with its
   * `expires_at`; a missing or malformed one is `unexpected`.
   * @param {Secret<string>} jwt - The app JWT.
   * @param {number} installationId - The installation id.
   * @returns {Promise<InstallationTokenMint>} The minted token, or why none was.
   */
  async mintInstallationToken(jwt: Secret<string>, installationId: number): Promise<InstallationTokenMint> {
    try {
      const { response, body } = await send(
        `${GITHUB_API_URL}/app/installations/${installationId}/access_tokens`,
        {
          method: 'POST',
          headers: { ...apiHeaders(`Bearer ${jwt.reveal()}`), 'Content-Type': 'application/json' },
          body: JSON.stringify({ permissions: INSTALLATION_TOKEN_PERMISSIONS }),
        },
        GITHUB_REPO_MAX_BODY_BYTES,
        { redirect: 'manual' },
      );

      return response.status === 201 ? parseMintedToken(body) : this.#mintFailure(response);
    } catch (error) {
      return { kind: 'unavailable', reason: clientErrorReason(error) };
    }
  }

  /**
   * Calls one listing and parses its page.
   * @param {RepoOperation} operation - The listing.
   * @param {string} path - The fixed path and query, page included.
   * @param {Secret<string> | null} token - The credential, or `null`.
   * @param {string | null | undefined} etag - The stored ETag.
   * @returns {Promise<RepoCall<RepoPageResult>>} The typed page.
   */
  #listing(
    operation: RepoOperation,
    path: string,
    token: Secret<string> | null,
    etag: string | null | undefined,
  ): Promise<RepoCall<RepoPageResult>> {
    return this.#call(operation, path, token, etag ?? null, GITHUB_REPO_LISTING_MAX_BODY_BYTES, (body, response) => {
      const repos = parseRepoListing(operation, body);

      if (repos === null) {
        return unexpected();
      }

      return {
        kind: 'ok',
        repos,
        etag: response.headers.get('etag'),
        hasNext: hasNextLink(response.headers.get('link')),
        rateLimit: rateLimitFields(response.headers),
      };
    });
  }

  /**
   * Sends one repo `GET` and classifies its answer; a `200` is handed to `onOk`.
   * @param {RepoOperation} operation - The operation.
   * @param {string} path - The fixed path and query.
   * @param {Secret<string> | null} token - The credential, or `null`.
   * @param {string | null} etag - The `If-None-Match` value, or `null`.
   * @param {number} maxBodyBytes - The body cap.
   * @param {Function} onOk - Parses a `200` body.
   * @returns {Promise<RepoCall<T>>} The typed result and the rate-limit headers.
   */
  async #call<T extends RepoPageResult | RepoResult>(
    operation: RepoOperation,
    path: string,
    token: Secret<string> | null,
    etag: string | null,
    maxBodyBytes: number,
    onOk: (body: string, response: Response) => T,
  ): Promise<RepoCall<T>> {
    let answer: { response: Response; body: string | null };

    try {
      answer = await send(`${GITHUB_API_URL}${path}`, { method: 'GET', headers: repoHeaders(token, etag) }, maxBodyBytes, {
        redirect: 'manual',
      });
    } catch (error) {
      return { result: { kind: 'unavailable', reason: clientErrorReason(error) } as T, rateLimit: null };
    }

    const { response, body } = answer;
    const rateLimit = rateLimitFields(response.headers);
    const classified = classifyRepoResponse(operation, response.status, rateLimit, token !== null, this.clock);

    if (classified === null) {
      return { result: body === null ? unexpected() as T : onOk(body, response), rateLimit };
    }

    const result = classified.kind === 'not_modified' ? { kind: 'not_modified', rateLimit } : classified;

    return { result: result as T, rateLimit };
  }

  /**
   * Maps a non-`201` mint answer, as the GitHub App test connection does:
   * `404` uninstalled, `403` suspended, `401` app JWT rejected.
   * @param {Response} response - GitHub's answer.
   * @returns {InstallationTokenMint} The failure.
   */
  #mintFailure(response: Response): InstallationTokenMint {
    const rateLimit = rateLimitFields(response.headers);

    if (isRateLimitAnswer(response.status, rateLimit)) {
      return { kind: 'rate_limited', resetAt: resetAtFor(rateLimit, this.clock) };
    }

    return MINT_FAILURES.get(response.status) ?? classifyRange(response.status);
  }
}

/**
 * The repo `GET` headers: the pinned API headers, `Authorization` only with a
 * token, and `If-None-Match` only with an ETag.
 * @param {Secret<string> | null} token - The credential, or `null`.
 * @param {string | null} etag - The stored ETag, or `null`.
 * @returns {Record<string, string>} The headers.
 */
function repoHeaders(token: Secret<string> | null, etag: string | null): Record<string, string> {
  const headers = token === null
    ? { Accept: 'application/vnd.github+json', 'X-GitHub-Api-Version': GITHUB_API_VERSION, 'User-Agent': GITHUB_USER_AGENT }
    : apiHeaders(`Bearer ${token.reveal()}`);

  return etag === null ? headers : { ...headers, 'If-None-Match': etag };
}

/**
 * The page query every listing appends.
 * @param {number} page - The 1-based page number.
 * @returns {string} `per_page=100&page=N`.
 */
function pageQuery(page: number): string {
  if (!Number.isSafeInteger(page) || page < 1) {
    throw new RangeError('page must be a positive integer');
  }

  return `per_page=${GITHUB_REPOS_PER_PAGE}&page=${page}`;
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
