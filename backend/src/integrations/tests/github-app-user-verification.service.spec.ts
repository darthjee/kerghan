import { inspect } from 'node:util';
import { GithubClientError } from '../github-client.service.js';
import {
  CredentialInvalidError,
  GithubRateLimitedError,
  GithubUnavailableError,
} from '../integration-errors.js';
import { Secret } from '../secret.js';
import {
  CANARY_USER_TOKEN,
  FAKE_APP_ID,
  FakeGithubClient,
  githubAppExchangeResponse,
  githubUserResponse,
  installationsPage,
  oauthExchangeResponse,
} from './support/fake-github-client.js';
import { enabledGithubAppConfig, TEST_APP_CALLBACK_URL, TEST_APP_CLIENT_ID } from './support/github-app-test-config.js';
import { GithubAppRevocationService } from '../types/github-app/github-app-revocation.service.js';
import { GithubAppUserVerificationService } from '../types/github-app/github-app-user-verification.service.js';

const CANARY_CODE = 'CANARYcanaryCODE0123';
const USER = 7;

/**
 * An installation entry.
 * @param {number} installationId - The id.
 * @param {number} appId - The app id.
 * @param {string} accountLogin - The account login.
 * @returns {object} The entry.
 */
function entry(installationId: number, appId = FAKE_APP_ID, accountLogin = 'acme') {
  return { installationId, appId, accountLogin, accountType: 'Organization' as const };
}

describe('GithubAppUserVerificationService', () => {
  let github: FakeGithubClient;
  let logger: { warn: jest.Mock; info: jest.Mock; error: jest.Mock; debug: jest.Mock };
  let service: GithubAppUserVerificationService;
  const config = enabledGithubAppConfig();

  beforeEach(() => {
    github = new FakeGithubClient().exchangeRespondByDefault(githubAppExchangeResponse());
    logger = { warn: jest.fn(), info: jest.fn(), error: jest.fn(), debug: jest.fn() };
    const revocation = new GithubAppRevocationService(github as never, logger as never, config);
    service = new GithubAppUserVerificationService(github as never, github as never, revocation, logger as never);
  });

  const verify = () => service.verify(config, new Secret(CANARY_CODE), USER);

  /**
   * Captures the rejection of `verify`.
   * @returns {Promise<Error>} The error.
   */
  async function failure(): Promise<Error> {
    try {
      await verify();
    } catch (error) {
      return error as Error;
    }

    throw new Error('expected verify to throw');
  }

  it('exchanges the code without PKCE, reads the login and the installations, then revokes', async () => {
    const result = await verify();

    expect(result).toEqual({ login: 'octocat', installations: [entry(12345678)] });
    const [exchange] = github.exchangeCalls;
    expect(exchange.clientId).toBe(TEST_APP_CLIENT_ID);
    expect(exchange.codeVerifier).toBeUndefined();
    expect(exchange.code.reveal()).toBe(CANARY_CODE);
    expect(exchange.redirectUri).toBe(TEST_APP_CALLBACK_URL);
    expect(github.calls[0].reveal()).toBe(CANARY_USER_TOKEN);
    expect(github.installationsCalls[0].token.reveal()).toBe(CANARY_USER_TOKEN);
    expect(github.installationsCalls[0].pageUrl).toBeUndefined();
    expect(github.revokedTokens).toEqual([CANARY_USER_TOKEN]);
    expect(github.appJwtCallCount).toBe(0);
  });

  it('keeps only this app\'s installations, deduplicated, across pages', async () => {
    github.installationsQueue.push(
      installationsPage({ installations: [entry(1), entry(2, 999)], nextUrl: 'https://api.github.com/p2' }),
      installationsPage({ installations: [entry(1), entry(3, FAKE_APP_ID, 'octocat')], nextUrl: null }),
    );

    const result = await verify();

    expect(result.installations.map((installation) => installation.installationId)).toEqual([1, 3]);
    expect(github.installationsCalls[1].pageUrl).toBe('https://api.github.com/p2');
  });

  it('stops after 10 pages and warns', async () => {
    github.defaultInstallations = installationsPage({ nextUrl: 'https://api.github.com/next' });

    await verify();

    expect(github.installationsCalls).toHaveLength(10);
    expect(logger.warn).toHaveBeenCalledWith('github app installations truncated', {
      type: 'github_app', userId: USER, pages: 10,
    });
  });

  describe('exchange errors', () => {
    it('maps bad_verification_code to CredentialInvalidError without a token to revoke', async () => {
      github.exchangeRespondWith(oauthExchangeResponse({ accessToken: null, error: 'bad_verification_code' }));

      expect(await failure()).toBeInstanceOf(CredentialInvalidError);
      expect(github.revokeCalls).toHaveLength(0);
      expect(github.callCount).toBe(0);
    });

    it.each(['incorrect_client_credentials', 'redirect_uri_mismatch'])(
      'maps %s to GithubUnavailableError, logged with the code only',
      async (code) => {
        github.exchangeRespondWith(oauthExchangeResponse({ accessToken: null, error: code }));

        expect(await failure()).toBeInstanceOf(GithubUnavailableError);
        expect(logger.error).toHaveBeenCalledWith('github app code exchange failed', { type: 'github_app', githubError: code });
      },
    );

    it('maps a token without the ghu_ prefix to GithubUnavailableError and revokes it', async () => {
      github.exchangeRespondWith(oauthExchangeResponse({ accessToken: new Secret('gho_CANARYcanaryWRONG') }));

      expect(await failure()).toBeInstanceOf(GithubUnavailableError);
      expect(github.revokedTokens).toEqual(['gho_CANARYcanaryWRONG']);
      expect(logger.error).toHaveBeenCalledWith('github app code exchange failed', {
        type: 'github_app', githubError: 'missing_user_token',
      });
    });

    it('maps a rate limit to GithubRateLimitedError', async () => {
      github.exchangeRespondWith(oauthExchangeResponse({ status: 429, accessToken: null, retryAfter: 12 }));

      expect(await failure()).toEqual(expect.objectContaining({ retryAfterSeconds: 12 }));
    });

    it('maps a 5xx and a network error to GithubUnavailableError', async () => {
      github.exchangeRespondWith(oauthExchangeResponse({ status: 502, accessToken: null }), new GithubClientError('timeout'));

      expect(await failure()).toBeInstanceOf(GithubUnavailableError);
      expect(await failure()).toBeInstanceOf(GithubUnavailableError);
    });

    it('rethrows an unexpected error', async () => {
      github.exchangeRespondWith(new TypeError('bug'));

      expect(await failure()).toBeInstanceOf(TypeError);
    });
  });

  describe('user token errors (each revokes the token)', () => {
    afterEach(() => {
      expect(github.revokedTokens).toEqual([CANARY_USER_TOKEN]);
    });

    it.each([
      ['GET /user 401', () => github.respondWith(githubUserResponse({ status: 401, login: null })), CredentialInvalidError],
      ['GET /user rate limited', () => github.respondWith(githubUserResponse({ status: 403, login: null, rateLimitRemaining: 0 })), GithubRateLimitedError],
      ['GET /user 500', () => github.respondWith(githubUserResponse({ status: 500, login: null })), GithubUnavailableError],
      ['GET /user with a non-GitHub login', () => github.respondWith(githubUserResponse({ login: 'not a login' })), GithubUnavailableError],
      ['installations 401', () => github.installationsQueue.push(installationsPage({ status: 401, installations: null })), CredentialInvalidError],
      ['installations rate limited', () => github.installationsQueue.push(installationsPage({ status: 429, installations: null, retryAfter: 5 })), GithubRateLimitedError],
      ['installations 403 without rate-limit headers', () => github.installationsQueue.push(installationsPage({ status: 403, installations: null })), GithubUnavailableError],
      ['installations 200 without the array', () => github.installationsQueue.push(installationsPage({ installations: null })), GithubUnavailableError],
      ['installations network error', () => github.installationsQueue.push(new GithubClientError('network_error')), GithubUnavailableError],
    ])('maps %s', async (_label, script, errorClass) => {
      script();

      const error = await failure();

      expect(error).toBeInstanceOf(errorClass);
      expect(inspect(error, { depth: 10 })).not.toContain('CANARYcanary');
    });

    it('rethrows an unexpected installations error', async () => {
      github.installationsQueue.push(new TypeError('bug'));

      expect(await failure()).toBeInstanceOf(TypeError);
    });
  });

  it('never logs the code or the token', async () => {
    github.revokeRespondWith({ status: 500 });
    github.exchangeRespondWith(oauthExchangeResponse({ accessToken: null, error: 'incorrect_client_credentials' }));
    await failure();
    await verify();

    const logged = inspect([logger.warn.mock.calls, logger.error.mock.calls, logger.info.mock.calls], { depth: 10 });
    expect(logged).not.toContain('CANARYcanary');
  });
});
