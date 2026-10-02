import { Injectable } from '@nestjs/common';
import { GithubRateLimitFields, isTimeout, parseJsonObject, rateLimitFields, readCappedBody } from './github-http.js';
import { Secret } from './secret.js';

// GitHub REST API base URL.
export const GITHUB_API_URL = 'https://api.github.com';
// GitHub's OAuth web flow token endpoint (on github.com, not the API host).
export const GITHUB_OAUTH_TOKEN_URL = 'https://github.com/login/oauth/access_token';
// REST API version pinned on every request.
export const GITHUB_API_VERSION = '2022-11-28';
// User-Agent GitHub requires on every request.
export const GITHUB_USER_AGENT = 'kerghan';
// Upper bound for a single GitHub call, in milliseconds.
export const GITHUB_TIMEOUT_MS = 10_000;
// Largest response body read from GitHub, in bytes; `GET /user` answers are a few KiB.
export const GITHUB_MAX_BODY_BYTES = 64 * 1024;
// Shape of an OAuth error code GitHub answers with (`bad_verification_code`, ...).
const OAUTH_ERROR_PATTERN = /^[a-z0-9_]{1,64}$/;
// Recorded instead of an OAuth `error` value that isn't a plain code.
export const UNRECOGNIZED_OAUTH_ERROR = 'unrecognized_error';
// Longest storable login: `integrations.github_login` is a `varchar(255)`.
export const GITHUB_LOGIN_MAX_LENGTH = 255;

/**
 * Whether a value is a login Kerghan can store: a non-empty string that fits
 * `integrations.github_login` (anything longer is treated as no login).
 * @param {unknown} login - The candidate login.
 * @returns {boolean} `true` for a non-empty string of at most `GITHUB_LOGIN_MAX_LENGTH` characters.
 */
export function isUsableLogin(login: unknown): login is string {
  return typeof login === 'string' && login !== '' && login.length <= GITHUB_LOGIN_MAX_LENGTH;
}

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
export interface GithubUserResponse extends GithubRateLimitFields {
  /** HTTP status GitHub answered with. */
  status: number;
  /** The `login` of the authenticated identity (200 only), or `null`. */
  login: string | null;
  /** Raw `X-OAuth-Scopes` header (comma-separated), or `null` when absent. */
  oauthScopes: string | null;
  /** Raw `GitHub-Authentication-Token-Expiration` header, or `null` when absent. */
  tokenExpiration: string | null;
}

/**
 * What `exchangeOauthCode` sends. Every credential stays wrapped in a `Secret`.
 */
export interface OauthCodeExchangeRequest {
  clientId: string;
  clientSecret: Secret<string>;
  code: Secret<string>;
  codeVerifier: Secret<string>;
  redirectUri: string;
}

/**
 * The normalised answer of the OAuth code exchange. GitHub reports exchange
 * errors as a 200 with an `error` field; `error_description` is never kept.
 */
export interface OauthCodeExchangeResponse extends GithubRateLimitFields {
  /** HTTP status GitHub answered with. */
  status: number;
  /** The `access_token`, when the body has one as a non-empty string, else `null`. */
  accessToken: Secret<string> | null;
  /** GitHub's `error` code only, or `null` when the body has none. */
  error: string | null;
}

/**
 * What `revokeOauthToken` sends.
 */
export interface OauthTokenRevocationRequest {
  clientId: string;
  clientSecret: Secret<string>;
  token: Secret<string>;
}

/**
 * The only place in the backend that calls GitHub. Every integration type
 * talks to GitHub through this service, so specs replace it with a fake
 * (`tests/support/fake-github-client.ts`); only its own spec stubs `fetch`.
 *
 * Every call refuses redirects (`redirect: 'error'`, surfacing as
 * `network_error`), so credentials are only ever sent to GitHub's own host,
 * is bounded by `GITHUB_TIMEOUT_MS`, and reads at most
 * `GITHUB_MAX_BODY_BYTES` of the body.
 */
@Injectable()
export class GithubClientService {
  /**
   * Calls `GET /user` with a token. A body over the size cap counts as
   * unparseable (no login).
   * @param {Secret<string>} token - The token, unwrapped only for the `Authorization` header.
   * @returns {Promise<GithubUserResponse>} GitHub's normalised answer, whatever its status.
   */
  async getUser(token: Secret<string>): Promise<GithubUserResponse> {
    const { response, body } = await send(`${GITHUB_API_URL}/user`, {
      method: 'GET',
      headers: apiHeaders(`Bearer ${token.reveal()}`),
    });

    return {
      status: response.status,
      login: response.status === 200 ? parseLogin(body) : null,
      oauthScopes: response.headers.get('x-oauth-scopes'),
      tokenExpiration: response.headers.get('github-authentication-token-expiration'),
      ...rateLimitFields(response.headers),
    };
  }

  /**
   * Exchanges an OAuth web flow `code` (with its PKCE `code_verifier`) for a
   * user access token: `POST https://github.com/login/oauth/access_token`.
   * @param {OauthCodeExchangeRequest} request - The app credentials, code, verifier and redirect URI.
   * @returns {Promise<OauthCodeExchangeResponse>} GitHub's normalised answer, whatever its status.
   */
  async exchangeOauthCode(request: OauthCodeExchangeRequest): Promise<OauthCodeExchangeResponse> {
    const { response, body } = await send(GITHUB_OAUTH_TOKEN_URL, {
      method: 'POST',
      headers: {
        Accept: 'application/json',
        'Content-Type': 'application/x-www-form-urlencoded',
        'User-Agent': GITHUB_USER_AGENT,
      },
      body: new URLSearchParams({
        client_id: request.clientId,
        client_secret: request.clientSecret.reveal(),
        code: request.code.reveal(),
        redirect_uri: request.redirectUri,
        code_verifier: request.codeVerifier.reveal(),
      }).toString(),
    });
    const parsed = parseJsonObject(body);

    return {
      status: response.status,
      accessToken: typeof parsed.access_token === 'string' && parsed.access_token !== ''
        ? new Secret(parsed.access_token)
        : null,
      error: oauthErrorCode(parsed.error),
      ...rateLimitFields(response.headers),
    };
  }

  /**
   * Revokes one OAuth App user access token:
   * `DELETE /applications/{client_id}/token`, with HTTP Basic app
   * credentials. Never touches the `/grant` endpoint (which would revoke
   * every token of the user's authorization).
   * @param {OauthTokenRevocationRequest} request - The app credentials and the token to revoke.
   * @returns {Promise<{ status: number }>} GitHub's status (204 on success).
   */
  async revokeOauthToken(request: OauthTokenRevocationRequest): Promise<{ status: number }> {
    const basic = Buffer.from(`${request.clientId}:${request.clientSecret.reveal()}`).toString('base64');
    const { response } = await send(
      `${GITHUB_API_URL}/applications/${encodeURIComponent(request.clientId)}/token`,
      {
        method: 'DELETE',
        headers: { ...apiHeaders(`Basic ${basic}`), 'Content-Type': 'application/json' },
        body: JSON.stringify({ access_token: request.token.reveal() }),
      },
    );

    return { status: response.status };
  }
}

/**
 * Sends one request with the shared safeguards (no redirects, timeout,
 * capped body read), turning any failure without an HTTP answer into a
 * sanitized `GithubClientError`.
 * @param {string} url - The GitHub URL.
 * @param {RequestInit} init - Method, headers and body.
 * @returns {Promise<{ response: Response, body: string | null }>} The response and its capped body.
 */
async function send(url: string, init: RequestInit): Promise<{ response: Response; body: string | null }> {
  try {
    const response = await fetch(url, { ...init, redirect: 'error', signal: AbortSignal.timeout(GITHUB_TIMEOUT_MS) });
    const body = await readCappedBody(response, GITHUB_MAX_BODY_BYTES);

    return { response, body };
  } catch (error) {
    throw new GithubClientError(isTimeout(error) ? 'timeout' : 'network_error');
  }
}

/**
 * The REST API headers, with a given `Authorization` value.
 * @param {string} authorization - The `Authorization` header value.
 * @returns {Record<string, string>} The headers.
 */
function apiHeaders(authorization: string): Record<string, string> {
  return {
    Authorization: authorization,
    Accept: 'application/vnd.github+json',
    'X-GitHub-Api-Version': GITHUB_API_VERSION,
    'User-Agent': GITHUB_USER_AGENT,
  };
}

/**
 * Reads the `login` field of a JSON body.
 * @param {string | null} body - The response body text, or `null` when it was too large.
 * @returns {string | null} The usable login, or `null` when absent, unparseable or too long.
 */
function parseLogin(body: string | null): string | null {
  const { login } = parseJsonObject(body);

  return isUsableLogin(login) ? login : null;
}

/**
 * Keeps GitHub's OAuth `error` only when it is a plain code, so nothing
 * free-form (or echoed back) ever reaches a log.
 * @param {unknown} error - The body's `error` field.
 * @returns {string | null} The code, `UNRECOGNIZED_OAUTH_ERROR`, or `null` when absent.
 */
function oauthErrorCode(error: unknown): string | null {
  if (error === undefined || error === null) {
    return null;
  }

  return typeof error === 'string' && OAUTH_ERROR_PATTERN.test(error) ? error : UNRECOGNIZED_OAUTH_ERROR;
}
