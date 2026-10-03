import { Injectable } from '@nestjs/common';
import type { EnabledGithubAppConfig } from './github-app-config.js';
import { isGithubLogin } from './github-app-metadata.js';
import { GithubAppRevocationService } from './github-app-revocation.service.js';
import { LoggerService } from '../../../core/logger.service.js';
import { fetchGithubUser, isRateLimited, retryAfterSecondsFor } from '../../github-answer.js';
import {
  GithubAppClientService,
  GithubInstallationsPage,
  GithubUserInstallation,
} from '../../github-app-client.service.js';
import { GithubClientError, GithubClientService, OauthCodeExchangeResponse } from '../../github-client.service.js';
import { CredentialInvalidError, GithubRateLimitedError, GithubUnavailableError } from '../../integration-errors.js';
import { Secret } from '../../secret.js';

// Prefix of every GitHub App user-to-server token.
export const GITHUB_APP_USER_TOKEN_PREFIX = 'ghu_';
// Most `GET /user/installations` pages followed (100 entries each).
export const GITHUB_APP_MAX_INSTALLATION_PAGES = 10;
// GitHub's exchange error for an unknown, expired or already used code.
const BAD_VERIFICATION_CODE = 'bad_verification_code';

/** What the user-token check proves: who the user is, and which installations of this app they can access. */
export interface VerifiedGithubUser {
  login: string;
  installations: GithubUserInstallation[];
}

/**
 * The ownership half of the GitHub App flow (spec *Validate / create*, steps
 * 1–2): exchanges the callback `code` for a user-to-server token, reads the
 * user's login and the installations of this app they can access, then
 * revokes the token best-effort on every path. The token (and any refresh
 * token) is never stored, logged or returned.
 */
@Injectable()
export class GithubAppUserVerificationService {
  private readonly github: GithubClientService;
  private readonly appClient: GithubAppClientService;
  private readonly revocation: GithubAppRevocationService;
  private readonly logger: LoggerService;

  /**
   * @param {GithubClientService} github - The shared GitHub client (exchange, `GET /user`).
   * @param {GithubAppClientService} appClient - The GitHub App calls (`GET /user/installations`).
   * @param {GithubAppRevocationService} revocation - Revokes the user token, best-effort.
   * @param {LoggerService} logger - Logs misconfiguration and truncation with safe fields only.
   */
  constructor(
    github: GithubClientService,
    appClient: GithubAppClientService,
    revocation: GithubAppRevocationService,
    logger: LoggerService,
  ) {
    this.github = github;
    this.appClient = appClient;
    this.revocation = revocation;
    this.logger = logger;
  }

  /**
   * Proves which installations of this app the user behind `code` can access.
   * @param {EnabledGithubAppConfig} config - The app config.
   * @param {Secret<string>} code - The callback code.
   * @param {number} userId - The Kerghan user, for the logs.
   * @returns {Promise<VerifiedGithubUser>} The verifying login and the verified installations.
   */
  async verify(config: EnabledGithubAppConfig, code: Secret<string>, userId: number): Promise<VerifiedGithubUser> {
    const token = await this.exchange(config, code, userId);

    try {
      const login = await this.loginOf(token);
      const installations = await this.installationsOf(token, config.appId, userId);

      return { login, installations };
    } finally {
      await this.revocation.revoke(token, userId);
    }
  }

  /**
   * Exchanges the code (no PKCE), revoking any token GitHub answered that isn't usable.
   * @param {EnabledGithubAppConfig} config - The app config.
   * @param {Secret<string>} code - The callback code.
   * @param {number} userId - The Kerghan user, for the logs.
   * @returns {Promise<Secret<string>>} The `ghu_` user token.
   */
  private async exchange(config: EnabledGithubAppConfig, code: Secret<string>, userId: number): Promise<Secret<string>> {
    let answer: OauthCodeExchangeResponse;

    try {
      answer = await this.github.exchangeOauthCode({
        clientId: config.clientId,
        clientSecret: config.clientSecret,
        code,
        redirectUri: config.callbackUrl,
      });
    } catch (error) {
      throw error instanceof GithubClientError ? new GithubUnavailableError() : error;
    }

    if (answer.status === 200 && answer.accessToken !== null && isUserToken(answer.accessToken.reveal())) {
      return answer.accessToken;
    }

    if (answer.accessToken !== null) {
      await this.revocation.revoke(answer.accessToken, userId);
    }

    throw this.exchangeErrorFor(answer);
  }

  /**
   * Maps a failed exchange answer to its domain error, logging misconfiguration.
   * @param {OauthCodeExchangeResponse} answer - The normalised answer.
   * @returns {Error} The error to throw.
   */
  private exchangeErrorFor(answer: OauthCodeExchangeResponse): Error {
    if (isRateLimited(answer)) {
      return new GithubRateLimitedError(retryAfterSecondsFor(answer, Date.now()));
    }

    if (answer.status !== 200) {
      return new GithubUnavailableError();
    }

    if (answer.error === BAD_VERIFICATION_CODE) {
      return new CredentialInvalidError();
    }

    this.logger.error('github app code exchange failed', {
      type: 'github_app',
      githubError: answer.error ?? 'missing_user_token',
    });

    return new GithubUnavailableError();
  }

  /**
   * Reads the verifying user's login with `GET /user`.
   * @param {Secret<string>} token - The user token.
   * @returns {Promise<string>} The login.
   */
  private async loginOf(token: Secret<string>): Promise<string> {
    const answer = await fetchGithubUser(this.github, token);

    switch (answer.kind) {
      case 'ok':
        if (isGithubLogin(answer.login)) {
          return answer.login;
        }
        throw new GithubUnavailableError();
      case 'unauthorized':
        throw new CredentialInvalidError();
      case 'rate_limited':
        throw new GithubRateLimitedError(answer.retryAfterSeconds);
      default:
        throw new GithubUnavailableError();
    }
  }

  /**
   * Lists the user's installations of this app, following `Link: rel="next"`
   * up to 10 pages (warning when more exist), deduplicated by id.
   * @param {Secret<string>} token - The user token.
   * @param {number} appId - The configured app id.
   * @param {number} userId - The Kerghan user, for the logs.
   * @returns {Promise<GithubUserInstallation[]>} The verified installations of this app.
   */
  private async installationsOf(token: Secret<string>, appId: number, userId: number): Promise<GithubUserInstallation[]> {
    const found = new Map<number, GithubUserInstallation>();
    let pageUrl: string | undefined;

    for (let page = 1; page <= GITHUB_APP_MAX_INSTALLATION_PAGES; page += 1) {
      const installations = await this.fetchPage(token, pageUrl);

      installations.entries
        .filter((installation) => installation.appId === appId && !found.has(installation.installationId))
        .forEach((installation) => found.set(installation.installationId, installation));

      if (installations.nextUrl === null) {
        return [...found.values()];
      }

      pageUrl = installations.nextUrl;
    }

    this.logger.warn('github app installations truncated', {
      type: 'github_app',
      userId,
      pages: GITHUB_APP_MAX_INSTALLATION_PAGES,
    });

    return [...found.values()];
  }

  /**
   * Fetches and classifies one installations page.
   * @param {Secret<string>} token - The user token.
   * @param {string | undefined} pageUrl - The page URL (first page when absent).
   * @returns {Promise<{ entries: GithubUserInstallation[], nextUrl: string | null }>} The page's entries.
   */
  private async fetchPage(
    token: Secret<string>,
    pageUrl: string | undefined,
  ): Promise<{ entries: GithubUserInstallation[]; nextUrl: string | null }> {
    let page: GithubInstallationsPage;

    try {
      page = await this.appClient.listUserInstallations(token, pageUrl);
    } catch (error) {
      throw error instanceof GithubClientError ? new GithubUnavailableError() : error;
    }

    if (page.status === 200 && page.installations !== null) {
      return { entries: page.installations, nextUrl: page.nextUrl };
    }

    throw pageErrorFor(page);
  }
}

/**
 * Whether a value is a GitHub App user-to-server token.
 * @param {string} token - The candidate.
 * @returns {boolean} Whether it starts with `ghu_` and has more.
 */
function isUserToken(token: string): boolean {
  return token.startsWith(GITHUB_APP_USER_TOKEN_PREFIX) && token.length > GITHUB_APP_USER_TOKEN_PREFIX.length;
}

/**
 * Maps a failed installations page to its domain error.
 * @param {GithubInstallationsPage} page - The normalised page.
 * @returns {Error} The error.
 */
function pageErrorFor(page: GithubInstallationsPage): Error {
  if (page.status === 401) {
    return new CredentialInvalidError();
  }

  if (isRateLimited(page)) {
    return new GithubRateLimitedError(retryAfterSecondsFor(page, Date.now()));
  }

  return new GithubUnavailableError();
}
