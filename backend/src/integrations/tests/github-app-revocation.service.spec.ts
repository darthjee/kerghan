import { inspect } from 'node:util';
import { GithubClientError } from '../github-client.service.js';
import { Secret } from '../secret.js';
import { CANARY_USER_TOKEN, FakeGithubClient } from './support/fake-github-client.js';
import { CANARY_APP_CLIENT_SECRET, enabledGithubAppConfig, TEST_APP_CLIENT_ID } from './support/github-app-test-config.js';
import { GithubAppRevocationService } from '../types/github-app/github-app-revocation.service.js';

describe('GithubAppRevocationService', () => {
  let github: FakeGithubClient;
  let logger: { warn: jest.Mock; info: jest.Mock; error: jest.Mock; debug: jest.Mock };

  beforeEach(() => {
    github = new FakeGithubClient();
    logger = { warn: jest.fn(), info: jest.fn(), error: jest.fn(), debug: jest.fn() };
  });

  const build = (config = enabledGithubAppConfig()): GithubAppRevocationService =>
    new GithubAppRevocationService(github as never, logger as never, config);

  it('revokes the single token with the GitHub App credentials', async () => {
    await build().revoke(new Secret(CANARY_USER_TOKEN), 7);

    expect(github.revokeCalls).toHaveLength(1);
    expect(github.revokeCalls[0].clientId).toBe(TEST_APP_CLIENT_ID);
    expect(github.revokeCalls[0].clientSecret.reveal()).toBe(CANARY_APP_CLIENT_SECRET);
    expect(github.revokedTokens).toEqual([CANARY_USER_TOKEN]);
    expect(logger.warn).not.toHaveBeenCalled();
  });

  it('logs a non-204 at warn level with safe fields only', async () => {
    github.revokeRespondWith({ status: 422 });

    await build().revoke(new Secret(CANARY_USER_TOKEN), 7);

    expect(logger.warn).toHaveBeenCalledWith('github app token revocation failed', {
      type: 'github_app', userId: 7, githubStatus: 422,
    });
  });

  it.each([
    [new GithubClientError('timeout'), 'timeout'],
    [new Error('boom'), 'unexpected_error'],
  ])('swallows a thrown %p', async (error, reason) => {
    github.revokeRespondWith(error);

    await expect(build().revoke(new Secret(CANARY_USER_TOKEN), 7)).resolves.toBeUndefined();
    expect(logger.warn).toHaveBeenCalledWith('github app token revocation failed', { type: 'github_app', userId: 7, reason });
    expect(inspect(logger.warn.mock.calls, { depth: 10 })).not.toContain('CANARYcanary');
  });

  it('skips while disabled', async () => {
    await build({ enabled: false } as never).revoke(new Secret(CANARY_USER_TOKEN), 7);

    expect(github.revokeCalls).toHaveLength(0);
    expect(logger.warn).toHaveBeenCalledWith('github app token revocation skipped', expect.any(Object));
  });
});
