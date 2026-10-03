import { verify as verifySignature } from 'node:crypto';
import { inspect } from 'node:util';
import { GithubClientError } from '../github-client.service.js';
import {
  GithubRateLimitedError,
  GithubUnavailableError,
  InstallationNotAccessibleError,
  InstallationSuspendedError,
  InsufficientPermissionsError,
} from '../integration-errors.js';
import {
  appInstallationResponse,
  FakeGithubClient,
  installationTokenResponse,
} from './support/fake-github-client.js';
import { enabledGithubAppConfig } from './support/github-app-test-config.js';
import { githubAppTestKey } from './support/github-app-test-key.js';
import { GithubAppInstallationService } from '../types/github-app/github-app-installation.service.js';

const ID = 12345678;

describe('GithubAppInstallationService', () => {
  let github: FakeGithubClient;
  let logger: { warn: jest.Mock; info: jest.Mock; error: jest.Mock; debug: jest.Mock };
  let service: GithubAppInstallationService;
  const config = enabledGithubAppConfig();

  beforeEach(() => {
    github = new FakeGithubClient();
    logger = { warn: jest.fn(), info: jest.fn(), error: jest.fn(), debug: jest.fn() };
    service = new GithubAppInstallationService(github as never, logger as never);
  });

  /**
   * Captures the rejection of `verify`.
   * @returns {Promise<Error>} The error.
   */
  async function failure(): Promise<Error> {
    try {
      await service.verify(config, ID);
    } catch (error) {
      return error as Error;
    }

    throw new Error('expected verify to throw');
  }

  it('looks the installation up, then mints a token, each with a fresh valid app JWT', async () => {
    const installation = await service.verify(config, ID);

    expect(installation).toEqual(appInstallationResponse().installation);
    expect(github.appInstallationCalls[0].installationId).toBe(ID);
    expect(github.tokenCalls[0].installationId).toBe(ID);

    const jwts = [github.appInstallationCalls[0].jwt.reveal(), github.tokenCalls[0].jwt.reveal()];
    jwts.forEach((jwt) => {
      const [header, payload, signature] = jwt.split('.');
      expect(verifySignature('sha256', Buffer.from(`${header}.${payload}`), githubAppTestKey().publicKey,
        Buffer.from(signature, 'base64url'))).toBe(true);
    });
    expect(github.appInstallationCalls[0].jwt).not.toBe(github.tokenCalls[0].jwt);
  });

  it('accepts write permissions', async () => {
    github.appInstallationQueue.push(appInstallationResponse({ permissions: { issues: 'write', metadata: 'read' } }));

    expect((await service.verify(config, ID)).permissions).toEqual({ issues: 'write', metadata: 'read' });
  });

  describe('verify error mapping', () => {
    it.each([
      ['lookup 404', () => github.appInstallationQueue.push(appInstallationResponse({}, { status: 404, installation: null })), InstallationNotAccessibleError],
      ['another app id', () => github.appInstallationQueue.push(appInstallationResponse({ appId: 999 })), InstallationNotAccessibleError],
      ['missing issues', () => github.appInstallationQueue.push(appInstallationResponse({ permissions: { issues: null, metadata: 'read' } })), InsufficientPermissionsError],
      ['missing metadata', () => github.appInstallationQueue.push(appInstallationResponse({ permissions: { issues: 'read', metadata: null } })), InsufficientPermissionsError],
      ['suspended', () => github.appInstallationQueue.push(appInstallationResponse({ suspended: true })), InstallationSuspendedError],
      ['mint 403', () => github.tokenQueue.push(installationTokenResponse({ status: 403 })), InstallationSuspendedError],
      ['mint 404', () => github.tokenQueue.push(installationTokenResponse({ status: 404 })), InstallationNotAccessibleError],
      ['lookup 403 rate limited', () => github.appInstallationQueue.push(appInstallationResponse({}, { status: 403, installation: null, rateLimitRemaining: 0 })), GithubRateLimitedError],
      ['mint 403 rate limited', () => github.tokenQueue.push(installationTokenResponse({ status: 403, retryAfter: 9 })), GithubRateLimitedError],
      ['lookup 401', () => github.appInstallationQueue.push(appInstallationResponse({}, { status: 401, installation: null })), GithubUnavailableError],
      ['mint 401', () => github.tokenQueue.push(installationTokenResponse({ status: 401 })), GithubUnavailableError],
      ['lookup 500', () => github.appInstallationQueue.push(appInstallationResponse({}, { status: 500, installation: null })), GithubUnavailableError],
      ['lookup 200 without the fields', () => github.appInstallationQueue.push(appInstallationResponse({}, { installation: null })), GithubUnavailableError],
      ['mint 500', () => github.tokenQueue.push(installationTokenResponse({ status: 500 })), GithubUnavailableError],
      ['a network error', () => github.appInstallationQueue.push(new GithubClientError('timeout')), GithubUnavailableError],
    ])('maps %s', async (_label, script, errorClass) => {
      script();

      expect(await failure()).toBeInstanceOf(errorClass);
    });

    it('stops before minting when the lookup fails', async () => {
      github.appInstallationQueue.push(appInstallationResponse({ suspended: true }));
      await failure();

      expect(github.tokenCalls).toHaveLength(0);
    });

    it('logs an app-JWT 401 as misconfiguration, without JWT or key material', async () => {
      github.appInstallationQueue.push(appInstallationResponse({}, { status: 401, installation: null }));
      await failure();

      expect(logger.error).toHaveBeenCalledWith(expect.stringContaining('github app authentication failed'), {
        type: 'github_app', githubStatus: 401,
      });
      const logged = inspect(logger.error.mock.calls, { depth: 10 });
      expect(logged).not.toContain('eyJ');
      expect(logged).not.toContain('PRIVATE KEY');
    });

    it('rethrows an unexpected error', async () => {
      github.appInstallationQueue.push(new TypeError('bug'));

      expect(await failure()).toBeInstanceOf(TypeError);
    });
  });

  describe('probe (test connection)', () => {
    it.each([
      ['healthy', () => undefined, { kind: 'ok', installation: appInstallationResponse().installation }],
      ['lookup 404', () => github.appInstallationQueue.push(appInstallationResponse({}, { status: 404, installation: null })), { kind: 'invalid', reason: 'uninstalled' }],
      ['another app id', () => github.appInstallationQueue.push(appInstallationResponse({ appId: 1 })), { kind: 'invalid', reason: 'uninstalled' }],
      ['suspended', () => github.appInstallationQueue.push(appInstallationResponse({ suspended: true })), { kind: 'invalid', reason: 'suspended' }],
      ['missing permissions', () => github.appInstallationQueue.push(appInstallationResponse({ permissions: { issues: null, metadata: null } })), { kind: 'invalid', reason: 'insufficient_permissions' }],
      ['mint 404', () => github.tokenQueue.push(installationTokenResponse({ status: 404 })), { kind: 'invalid', reason: 'uninstalled' }],
      ['mint 403', () => github.tokenQueue.push(installationTokenResponse({ status: 403 })), { kind: 'invalid', reason: 'suspended' }],
      ['rate limited', () => github.tokenQueue.push(installationTokenResponse({ status: 429, retryAfter: 30 })), { kind: 'transient', error: 'rate_limited', retryAfterSeconds: 30 }],
      ['app-JWT 401', () => github.appInstallationQueue.push(appInstallationResponse({}, { status: 401, installation: null })), { kind: 'transient', error: 'unavailable' }],
      ['5xx', () => github.appInstallationQueue.push(appInstallationResponse({}, { status: 503, installation: null })), { kind: 'transient', error: 'unavailable' }],
      ['network error', () => github.tokenQueue.push(new GithubClientError('network_error')), { kind: 'transient', error: 'unavailable' }],
    ])('maps %s', async (_label, script, outcome) => {
      script();

      expect(await service.probe(config, ID)).toEqual(outcome);
    });
  });
});
