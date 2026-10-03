import { HttpException } from '@nestjs/common';
import { InstallationSuspendedError } from '../integration-errors.js';
import { Secret } from '../secret.js';
import {
  appInstallationResponse,
  CANARY_USER_TOKEN,
  FakeGithubClient,
  githubAppExchangeResponse,
  installationTokenResponse,
} from './support/fake-github-client.js';
import { enabledGithubAppConfig } from './support/github-app-test-config.js';
import type { GithubAppConfig } from '../types/github-app/github-app-config.js';
import { GithubAppInstallationService } from '../types/github-app/github-app-installation.service.js';
import { GithubAppRevocationService } from '../types/github-app/github-app-revocation.service.js';
import { GithubAppUserVerificationService } from '../types/github-app/github-app-user-verification.service.js';
import { GithubAppStrategy } from '../types/github-app/github-app.strategy.js';
import { IntegrationTypeRegistry } from '../types/integration-type-registry.js';
import type { IntegrationView } from '../types/integration-type-strategy.js';

const METADATA = {
  installationId: 12345678,
  appId: 123456,
  accountLogin: 'acme',
  accountType: 'Organization',
  repositorySelection: 'selected',
  permissions: { issues: 'read', metadata: 'read' },
  verifiedBy: 'octocat',
};

/**
 * A stored `github_app` integration view.
 * @param {Record<string, unknown>} metadata - The stored metadata.
 * @returns {IntegrationView} The view.
 */
function view(metadata: Record<string, unknown> = METADATA): IntegrationView {
  return {
    uuid: '0b6c1f8e-3a52-4c1b-9d5a-6f2e7c8d9a10',
    type: 'github_app',
    status: 'active',
    statusReason: null,
    githubLogin: 'acme',
    expiresAt: null,
    metadata,
  };
}

describe('GithubAppStrategy', () => {
  let github: FakeGithubClient;
  let logger: { warn: jest.Mock; info: jest.Mock; error: jest.Mock; debug: jest.Mock };

  /**
   * Builds the strategy over the fake client.
   * @param {GithubAppConfig} config - The config.
   * @returns {GithubAppStrategy} The strategy.
   */
  function build(config: GithubAppConfig = enabledGithubAppConfig()): GithubAppStrategy {
    const revocation = new GithubAppRevocationService(github as never, logger as never, config);
    const verification = new GithubAppUserVerificationService(github as never, github as never, revocation, logger as never);
    const installations = new GithubAppInstallationService(github as never, logger as never);

    return new GithubAppStrategy(verification, installations, config);
  }

  beforeEach(() => {
    github = new FakeGithubClient().exchangeRespondByDefault(githubAppExchangeResponse());
    logger = { warn: jest.fn(), info: jest.fn(), error: jest.fn(), debug: jest.fn() };
  });

  it('is redirect-only, and enabled only with the config', () => {
    expect(build().flows).toEqual({ credentialPaste: false, redirect: true });
    expect(build().isEnabled()).toBe(true);
    expect(build({ enabled: false }).isEnabled()).toBe(false);
    expect(build({ enabled: false }).enabledConfig()).toBeNull();
  });

  it('is listed by the registry only while enabled', () => {
    expect(new IntegrationTypeRegistry([build({ enabled: false })]).enabledTypes()).toEqual([]);
    expect(new IntegrationTypeRegistry([build()]).enabledTypes().map(({ type }) => type)).toEqual(['github_app']);
  });

  it.each([
    ['parseCredential', (strategy: GithubAppStrategy) => Promise.resolve().then(() => strategy.parseCredential({}))],
    ['validate', (strategy: GithubAppStrategy) => strategy.validate(new Secret({}))],
  ])('rejects %s as INTEGRATION_FLOW_UNSUPPORTED', async (_label, call) => {
    const error = await call(build()).catch((caught: unknown) => caught) as HttpException;

    expect(error.getStatus()).toBe(400);
    expect(error.getResponse()).toEqual(expect.objectContaining({ code: 'INTEGRATION_FLOW_UNSUPPORTED' }));
  });

  it('parses the secret payload', () => {
    expect(build().parseSecretPayload(new Secret({ installationId: 5 }))?.reveal()).toEqual({ installationId: 5 });
    expect(build().parseSecretPayload(new Secret({ installationId: 5, extra: 1 }))).toBeNull();
    expect(build().parseSecretPayload(new Secret({ installationId: '5' }))).toBeNull();
  });

  it('masks the installation id', () => {
    expect(build().mask(new Secret({ installationId: 12345678 }))).toBe('installation …5678');
  });

  it('describes metadata strictly', () => {
    expect(build().describeMetadata(METADATA)).toEqual(METADATA);
    expect(() => build().describeMetadata({ ...METADATA, extra: true })).toThrow();
  });

  it('verifies the user and revokes the token', async () => {
    const config = enabledGithubAppConfig();
    const verified = await build(config).verifyUser(config, new Secret('code'), 1);

    expect(verified.login).toBe('octocat');
    expect(github.revokedTokens).toEqual([CANARY_USER_TOKEN]);
  });

  it('validates an installation into what gets stored', async () => {
    const config = enabledGithubAppConfig();
    const validated = await build(config).validateInstallation(config, 12345678, 'octocat');

    expect(validated.secret.reveal()).toEqual({ installationId: 12345678 });
    expect(validated).toMatchObject({ githubLogin: 'acme', expiresAt: null, metadata: METADATA });
  });

  it('propagates installation errors', async () => {
    const config = enabledGithubAppConfig();
    github.appInstallationQueue.push(appInstallationResponse({ suspended: true }));

    await expect(build(config).validateInstallation(config, 12345678, 'octocat')).rejects.toBeInstanceOf(InstallationSuspendedError);
  });

  describe('test', () => {
    it('refreshes every field but verifiedBy, with no expiry', async () => {
      github.appInstallationQueue.push(appInstallationResponse({
        accountLogin: 'acme-renamed', repositorySelection: 'all', permissions: { issues: 'write', metadata: 'read' },
      }));

      expect(await build().test(new Secret({ installationId: 12345678 }), view())).toEqual({
        kind: 'active',
        githubLogin: 'acme-renamed',
        expiresAt: null,
        metadata: {
          ...METADATA,
          accountLogin: 'acme-renamed',
          repositorySelection: 'all',
          permissions: { issues: 'write', metadata: 'read' },
          verifiedBy: 'octocat',
        },
      });
      expect(github.appInstallationCalls[0].installationId).toBe(12345678);
      expect(github.totalCallCount).toBe(2);
    });

    it('falls back to the account login when the stored verifiedBy is unusable', async () => {
      const outcome = await build().test(new Secret({ installationId: 12345678 }), view({ ...METADATA, verifiedBy: 5 }));

      expect(outcome).toMatchObject({ kind: 'active', metadata: { verifiedBy: 'acme' } });
    });

    it.each([
      ['uninstalled', () => github.appInstallationQueue.push(appInstallationResponse({}, { status: 404, installation: null })), { kind: 'invalid', reason: 'uninstalled' }],
      ['suspended', () => github.tokenQueue.push(installationTokenResponse({ status: 403 })), { kind: 'invalid', reason: 'suspended' }],
      ['insufficient permissions', () => github.appInstallationQueue.push(appInstallationResponse({ permissions: { issues: 'read', metadata: null } })), { kind: 'invalid', reason: 'insufficient_permissions' }],
      ['rate limited', () => github.appInstallationQueue.push(appInstallationResponse({}, { status: 429, installation: null, retryAfter: 4 })), { kind: 'transient', error: 'rate_limited', retryAfterSeconds: 4 }],
    ])('maps %s', async (_label, script, outcome) => {
      script();

      expect(await build().test(new Secret({ installationId: 12345678 }), view())).toEqual(outcome);
    });

    it('answers transient unavailable without any GitHub call while disabled', async () => {
      expect(await build({ enabled: false }).test(new Secret({ installationId: 12345678 }), view()))
        .toEqual({ kind: 'transient', error: 'unavailable' });
      expect(github.totalCallCount).toBe(0);
    });
  });

  describe('onDelete', () => {
    it.each([
      ['an active row', new Secret({ installationId: 1 }), enabledGithubAppConfig()],
      ['an undecryptable row', null, enabledGithubAppConfig()],
      ['a row while disabled', new Secret({ installationId: 1 }), { enabled: false } as GithubAppConfig],
    ])('makes no GitHub call for %s', async (_label, secret, config) => {
      await expect(build(config).onDelete(secret, view())).resolves.toBeUndefined();
      expect(github.totalCallCount).toBe(0);
    });
  });
});
