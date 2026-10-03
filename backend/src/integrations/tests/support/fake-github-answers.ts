import type {
  GithubAppInstallationResponse,
  GithubInstallationsPage,
  GithubInstallationTokenResponse,
} from '../../github-app-client.service.js';
import type { GithubUserResponse, OauthCodeExchangeResponse } from '../../github-client.service.js';
import { Secret } from '../../secret.js';

/** A recognisable OAuth App user access token that must never leak anywhere. */
export const CANARY_OAUTH_TOKEN = 'gho_CANARYcanaryOAUTH0000000000000000e5f6';

/** A recognisable GitHub App user-to-server token that must never leak anywhere. */
export const CANARY_USER_TOKEN = 'ghu_CANARYcanaryUSER00000000000000000a7b8';
/** The app id the fake GitHub App answers use (matches the test config). */
export const FAKE_APP_ID = 123456;
/** The installation id the fake GitHub App answers use by default. */
export const FAKE_INSTALLATION_ID = 12345678;

/** A scripted answer: a response, or an error to throw (e.g. a `GithubClientError`). */
export type FakeGithubAnswer = GithubUserResponse | Error;
/** A scripted code exchange answer. */
export type FakeExchangeAnswer = OauthCodeExchangeResponse | Error;
/** A scripted revocation answer. */
export type FakeRevokeAnswer = { status: number } | Error;
/** A scripted `GET /user/installations` page. */
export type FakeInstallationsAnswer = GithubInstallationsPage | Error;
/** A scripted `GET /app/installations/{id}` answer. */
export type FakeAppInstallationAnswer = GithubAppInstallationResponse | Error;
/** A scripted installation token mint answer. */
export type FakeTokenAnswer = GithubInstallationTokenResponse | Error;

// No rate-limit headers.
const NO_RATE_LIMIT = { rateLimitRemaining: null, rateLimitReset: null, retryAfter: null };

/**
 * Builds a `GET /user/installations` page (one installation of the fake app by default).
 * @param {Partial<GithubInstallationsPage>} overrides - Fields to override.
 * @returns {GithubInstallationsPage} The page.
 */
export function installationsPage(overrides: Partial<GithubInstallationsPage> = {}): GithubInstallationsPage {
  return {
    status: 200,
    installations: [
      { installationId: FAKE_INSTALLATION_ID, appId: FAKE_APP_ID, accountLogin: 'acme', accountType: 'Organization' },
    ],
    nextUrl: null,
    ...NO_RATE_LIMIT,
    ...overrides,
  };
}

/**
 * Builds a `GET /app/installations/{id}` answer (a healthy installation of the fake app by default).
 * @param {Partial<GithubAppInstallationResponse['installation']>} installation - Installation fields to override.
 * @param {Partial<GithubAppInstallationResponse>} overrides - Response fields to override.
 * @returns {GithubAppInstallationResponse} The answer.
 */
export function appInstallationResponse(
  installation: Partial<NonNullable<GithubAppInstallationResponse['installation']>> = {},
  overrides: Partial<GithubAppInstallationResponse> = {},
): GithubAppInstallationResponse {
  return {
    status: 200,
    installation: {
      installationId: FAKE_INSTALLATION_ID,
      appId: FAKE_APP_ID,
      accountLogin: 'acme',
      accountType: 'Organization',
      repositorySelection: 'selected',
      permissions: { issues: 'read', metadata: 'read' },
      suspended: false,
      ...installation,
    },
    ...NO_RATE_LIMIT,
    ...overrides,
  };
}

/**
 * Builds an installation token mint answer (201 by default).
 * @param {Partial<GithubInstallationTokenResponse>} overrides - Fields to override.
 * @returns {GithubInstallationTokenResponse} The answer.
 */
export function installationTokenResponse(
  overrides: Partial<GithubInstallationTokenResponse> = {},
): GithubInstallationTokenResponse {
  return { status: 201, ...NO_RATE_LIMIT, ...overrides };
}

/**
 * Builds a successful code exchange answer (the canary OAuth token by default).
 * @param {Partial<OauthCodeExchangeResponse>} overrides - Fields to override.
 * @returns {OauthCodeExchangeResponse} The answer.
 */
export function oauthExchangeResponse(overrides: Partial<OauthCodeExchangeResponse> = {}): OauthCodeExchangeResponse {
  return {
    status: 200,
    accessToken: new Secret(CANARY_OAUTH_TOKEN),
    error: null,
    rateLimitRemaining: null,
    rateLimitReset: null,
    retryAfter: null,
    ...overrides,
  };
}

/**
 * Builds a `GET /user` response with sensible defaults.
 * @param {Partial<GithubUserResponse>} overrides - Fields to override.
 * @returns {GithubUserResponse} The response.
 */
export function githubUserResponse(overrides: Partial<GithubUserResponse> = {}): GithubUserResponse {
  return {
    status: 200,
    login: 'octocat',
    oauthScopes: 'repo, read:org',
    tokenExpiration: null,
    rateLimitRemaining: 4999,
    rateLimitReset: null,
    retryAfter: null,
    ...overrides,
  };
}

/**
 * Builds a successful GitHub App code exchange answer (the canary user token).
 * @param {Partial<OauthCodeExchangeResponse>} overrides - Fields to override.
 * @returns {OauthCodeExchangeResponse} The answer.
 */
export function githubAppExchangeResponse(overrides: Partial<OauthCodeExchangeResponse> = {}): OauthCodeExchangeResponse {
  return oauthExchangeResponse({ accessToken: new Secret(CANARY_USER_TOKEN), ...overrides });
}
