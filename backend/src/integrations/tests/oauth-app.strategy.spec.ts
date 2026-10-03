import { inspect } from 'node:util';
import { HttpException } from '@nestjs/common';
import {
  CANARY_OAUTH_TOKEN,
  FakeGithubClient,
  githubUserResponse,
  oauthExchangeResponse,
} from './support/fake-github-client.js';
import type { LoggerService } from '../../core/logger.service.js';
import { GithubClientError, GithubClientService } from '../github-client.service.js';
import {
  CredentialInvalidError,
  GithubRateLimitedError,
  GithubUnavailableError,
  InsufficientPermissionsError,
  InvalidMetadataError,
} from '../integration-errors.js';
import { Secret } from '../secret.js';
import type { IntegrationView } from '../types/integration-type-strategy.js';
import { OauthAppCodeExchangeService } from '../types/oauth-app/oauth-app-code-exchange.service.js';
import { OauthAppConfig } from '../types/oauth-app/oauth-app-config.js';
import { OauthAppRevocationService } from '../types/oauth-app/oauth-app-revocation.service.js';
import { OAUTH_APP_REASON_REVOKED, OauthAppStrategy } from '../types/oauth-app/oauth-app.strategy.js';

const CLIENT_ID = 'Ov23liAbCdEf01234567';
const OTHER_CLIENT_ID = 'Ov23liOther000000000';
const CANARY_CLIENT_SECRET = 'CANARYcanarySECRET0123456789abcdef012345';
const CANARY_CODE = 'CANARYcanaryCODE0123';
const CANARY_VERIFIER = 'CANARYcanaryVERIFIER0123456789abcdefABCDEF';
const OTHER_TOKEN = 'gho_CANARYcanaryOTHER000000000000000000z9y8';

const ENABLED: OauthAppConfig = {
  enabled: true,
  clientId: CLIENT_ID,
  clientSecret: new Secret(CANARY_CLIENT_SECRET),
  callbackUrl: 'https://kerghan.example.com/integrations/oauth_app/callback',
};

interface Built {
  strategy: OauthAppStrategy;
  github: FakeGithubClient;
  logger: { debug: jest.Mock; info: jest.Mock; warn: jest.Mock; error: jest.Mock };
}

/**
 * Builds the strategy over the fake GitHub client and a fake logger.
 * @param {OauthAppConfig} config - The server config.
 * @returns {Built} The strategy and its doubles.
 */
function build(config: OauthAppConfig = ENABLED): Built {
  const github = new FakeGithubClient();
  const logger = { debug: jest.fn(), info: jest.fn(), warn: jest.fn(), error: jest.fn() };
  const client = github as unknown as GithubClientService;
  const revocation = new OauthAppRevocationService(client, logger as unknown as LoggerService, config);
  const exchange = new OauthAppCodeExchangeService(client, logger as unknown as LoggerService, revocation);

  return { strategy: new OauthAppStrategy(client, exchange, revocation, config), github, logger };
}

/**
 * The `{ code, codeVerifier }` payload the flow service builds.
 * @returns {Secret} The payload.
 */
function codePayload(): Secret {
  return new Secret({ code: CANARY_CODE, codeVerifier: CANARY_VERIFIER });
}

/**
 * A stored integration view.
 * @param {Record<string, unknown>} metadata - Its metadata.
 * @returns {IntegrationView} The view.
 */
function view(metadata: Record<string, unknown> = { scopes: ['repo'], clientId: CLIENT_ID }): IntegrationView {
  return {
    uuid: '0b6c1f8e-3a52-4c1b-9d5a-6f2e7c8d9a10',
    type: 'oauth_app',
    status: 'active',
    statusReason: null,
    githubLogin: 'octocat',
    expiresAt: null,
    metadata,
  };
}

/**
 * Captures what a call throws.
 * @param {Promise<unknown>} promise - The call.
 * @returns {Promise<Error>} The thrown error.
 */
async function rejection(promise: Promise<unknown>): Promise<Error> {
  try {
    await promise;
  } catch (error) {
    return error as Error;
  }

  throw new Error('expected the call to throw');
}

describe('OauthAppStrategy', () => {
  let built: Built;

  beforeEach(() => {
    built = build();
  });

  afterEach(() => {
    const logged = Object.values(built.logger).flatMap((mock) => mock.mock.calls);

    expect(inspect(logged, { depth: 10 })).not.toContain('CANARYcanary');
  });

  it('is the redirect-only oauth_app type', () => {
    expect(built.strategy.type).toBe('oauth_app');
    expect(built.strategy.flows).toEqual({ credentialPaste: false, redirect: true });
  });

  it('is enabled only with the server config', () => {
    expect(built.strategy.isEnabled()).toBe(true);
    expect(build({ enabled: false }).strategy.isEnabled()).toBe(false);
  });

  it('rejects a pasted credential', () => {
    expect(() => built.strategy.parseCredential({ token: CANARY_OAUTH_TOKEN })).toThrow(HttpException);
  });

  describe('validate', () => {
    it('exchanges the code with the verifier and builds the stored credential', async () => {
      built.github.respondWith(githubUserResponse({ oauthScopes: 'repo, read:org, repo' }));

      const validated = await built.strategy.validate(codePayload());

      const [exchange] = built.github.exchangeCalls;
      expect(exchange.clientId).toBe(CLIENT_ID);
      expect(exchange.clientSecret.reveal()).toBe(CANARY_CLIENT_SECRET);
      expect(exchange.code.reveal()).toBe(CANARY_CODE);
      expect(exchange.codeVerifier?.reveal()).toBe(CANARY_VERIFIER);
      expect(exchange.redirectUri).toBe(ENABLED.enabled && ENABLED.callbackUrl);
      expect(built.github.calls[0].reveal()).toBe(CANARY_OAUTH_TOKEN);
      expect(validated.secret.reveal()).toEqual({ token: CANARY_OAUTH_TOKEN });
      expect(validated).toMatchObject({
        githubLogin: 'octocat',
        expiresAt: null,
        metadata: { scopes: ['read:org', 'repo'], clientId: CLIENT_ID },
      });
      expect(JSON.stringify(validated.metadata)).not.toContain('CANARYcanary');
      expect(built.github.revokeCalls).toHaveLength(0);
    });

    it('maps bad_verification_code to a counted invalid credential, with no further call', async () => {
      built.github.exchangeRespondWith(oauthExchangeResponse({ accessToken: null, error: 'bad_verification_code' }));

      const error = await rejection(built.strategy.validate(codePayload()));

      expect(error).toBeInstanceOf(CredentialInvalidError);
      expect(built.github.callCount).toBe(0);
      expect(built.logger.error).not.toHaveBeenCalled();
    });

    it.each([
      ['another exchange error', oauthExchangeResponse({ accessToken: null, error: 'incorrect_client_credentials' }), 'incorrect_client_credentials'],
      ['a 200 without a token', oauthExchangeResponse({ accessToken: null }), 'missing_access_token'],
    ])('maps %s to an uncounted unavailable error, logging the code only', async (_label, answer, code) => {
      built.github.exchangeRespondWith(answer);

      const error = await rejection(built.strategy.validate(codePayload()));

      expect(error).toBeInstanceOf(GithubUnavailableError);
      expect(built.logger.error).toHaveBeenCalledWith('oauth app code exchange failed', { type: 'oauth_app', githubError: code });
    });

    it('revokes a token that does not start with gho_', async () => {
      built.github.exchangeRespondWith(oauthExchangeResponse({ accessToken: new Secret('ghu_CANARYcanaryWRONG') }));

      expect(await rejection(built.strategy.validate(codePayload()))).toBeInstanceOf(GithubUnavailableError);
      expect(built.github.revokedTokens).toEqual(['ghu_CANARYcanaryWRONG']);
    });

    it.each([
      ['a 429 with retry-after', { status: 429, retryAfter: 42 }, 42],
      ['a 403 with no remaining calls', { status: 403, rateLimitRemaining: 0 }, undefined],
    ])('maps an exchange rate limit (%s)', async (_label, overrides, retryAfter) => {
      built.github.exchangeRespondWith(oauthExchangeResponse({ accessToken: null, ...overrides }));

      const error = await rejection(built.strategy.validate(codePayload()));

      expect(error).toBeInstanceOf(GithubRateLimitedError);
      expect((error as GithubRateLimitedError).retryAfterSeconds).toBe(retryAfter);
    });

    it.each([
      ['a 5xx', oauthExchangeResponse({ status: 502, accessToken: null })],
      ['a network error', new GithubClientError('network_error')],
      ['a timeout', new GithubClientError('timeout')],
    ])('maps an exchange %s to unavailable', async (_label, answer) => {
      built.github.exchangeRespondWith(answer);

      expect(await rejection(built.strategy.validate(codePayload()))).toBeInstanceOf(GithubUnavailableError);
      expect(built.github.callCount).toBe(0);
    });

    it('rethrows an unexpected exchange failure as is', async () => {
      built.github.exchangeRespondWith(new TypeError('boom'));

      expect(await rejection(built.strategy.validate(codePayload()))).toBeInstanceOf(TypeError);
    });

    it.each([
      ['a 401', githubUserResponse({ status: 401, login: null }), CredentialInvalidError],
      ['no repo scope', githubUserResponse({ oauthScopes: 'read:org' }), InsufficientPermissionsError],
      ['a rate limit', githubUserResponse({ status: 429, login: null, retryAfter: 5 }), GithubRateLimitedError],
      ['a 5xx', githubUserResponse({ status: 503, login: null }), GithubUnavailableError],
      ['a 200 without a login', githubUserResponse({ login: null }), GithubUnavailableError],
      ['a network error', new GithubClientError('network_error'), GithubUnavailableError],
    ])('maps GET /user %s and revokes the new token', async (_label, answer, errorClass) => {
      built.github.respondWith(answer);

      const error = await rejection(built.strategy.validate(codePayload()));

      expect(error).toBeInstanceOf(errorClass);
      expect(built.github.revokedTokens).toEqual([CANARY_OAUTH_TOKEN]);
      expect(built.github.revokeCalls[0].clientId).toBe(CLIENT_ID);
      expect(inspect(error, { depth: 10 })).not.toContain('CANARYcanary');
    });

    it('still throws the validation error when revoking the new token fails', async () => {
      built.github.respondWith(githubUserResponse({ oauthScopes: '' }));
      built.github.revokeRespondWith(new GithubClientError('timeout'));

      expect(await rejection(built.strategy.validate(codePayload()))).toBeInstanceOf(InsufficientPermissionsError);
      expect(built.logger.warn).toHaveBeenCalledWith('oauth app token revocation failed', { type: 'oauth_app', reason: 'timeout' });
    });

    it('fails as unavailable while disabled, without calling GitHub', async () => {
      const disabled = build({ enabled: false });

      expect(await rejection(disabled.strategy.validate(codePayload()))).toBeInstanceOf(GithubUnavailableError);
      expect(disabled.github.totalCallCount).toBe(0);
    });
  });

  describe('test', () => {
    const stored = new Secret({ token: CANARY_OAUTH_TOKEN });

    it('answers active with refreshed login and metadata, keeping the stored client id', async () => {
      built.github.respondWith(githubUserResponse({ login: 'hubot', oauthScopes: 'repo,gist' }));

      expect(await built.strategy.test(stored, view({ scopes: ['repo'], clientId: OTHER_CLIENT_ID }))).toEqual({
        kind: 'active',
        githubLogin: 'hubot',
        expiresAt: null,
        metadata: { scopes: ['gist', 'repo'], clientId: OTHER_CLIENT_ID },
      });
      expect(built.github.calls[0].reveal()).toBe(CANARY_OAUTH_TOKEN);
    });

    it('answers invalid + insufficient_permissions without repo', async () => {
      built.github.respondWith(githubUserResponse({ oauthScopes: 'gist' }));

      expect(await built.strategy.test(stored, view())).toEqual({ kind: 'invalid', reason: 'insufficient_permissions' });
    });

    it('answers invalid + revoked on a 401', async () => {
      built.github.respondWith(githubUserResponse({ status: 401, login: null }));

      expect(await built.strategy.test(stored, view())).toEqual({ kind: 'invalid', reason: OAUTH_APP_REASON_REVOKED });
    });

    it('answers a transient rate limit', async () => {
      built.github.respondWith(githubUserResponse({ status: 403, login: null, rateLimitRemaining: 0, retryAfter: 9 }));

      expect(await built.strategy.test(stored, view())).toEqual({ kind: 'transient', error: 'rate_limited', retryAfterSeconds: 9 });
    });

    it.each([
      ['a 5xx', githubUserResponse({ status: 500, login: null })],
      ['a network error', new GithubClientError('network_error')],
      ['an unexpected status', githubUserResponse({ status: 418, login: null })],
    ])('answers transient unavailable on %s', async (_label, answer) => {
      built.github.respondWith(answer);

      expect(await built.strategy.test(stored, view())).toEqual({ kind: 'transient', error: 'unavailable' });
    });

    it('works while the type is disabled', async () => {
      const disabled = build({ enabled: false });
      disabled.github.respondWith(githubUserResponse({ oauthScopes: 'repo' }));

      expect(await disabled.strategy.test(stored, view())).toMatchObject({
        kind: 'active',
        metadata: { scopes: ['repo'], clientId: CLIENT_ID },
      });
    });
  });

  describe('parseSecretPayload', () => {
    it('accepts { token: gho_… }', () => {
      expect(built.strategy.parseSecretPayload(new Secret({ token: CANARY_OAUTH_TOKEN }))?.reveal())
        .toEqual({ token: CANARY_OAUTH_TOKEN });
    });

    it.each([
      ['a non-object', 'gho_x'],
      ['null', null],
      ['an array', [CANARY_OAUTH_TOKEN]],
      ['another prefix', { token: 'ghp_abcd' }],
      ['the bare prefix', { token: 'gho_' }],
      ['a non-string token', { token: 42 }],
      ['an extra key', { token: CANARY_OAUTH_TOKEN, refresh: 'x' }],
    ])('rejects %s', (_label, payload) => {
      expect(built.strategy.parseSecretPayload(new Secret(payload))).toBeNull();
    });
  });

  describe('describeMetadata', () => {
    it('accepts the valid shape, sorting and de-duplicating the scopes', () => {
      expect(built.strategy.describeMetadata({ scopes: ['repo', 'gist', 'repo'], clientId: CLIENT_ID }))
        .toEqual({ scopes: ['gist', 'repo'], clientId: CLIENT_ID });
    });

    it.each([
      ['a non-object', 'x'],
      ['an array', []],
      ['an extra key', { scopes: ['repo'], clientId: CLIENT_ID, token: 'x' }],
      ['a missing clientId', { scopes: ['repo'] }],
      ['a missing scopes', { clientId: CLIENT_ID }],
      ['non-array scopes', { scopes: 'repo', clientId: CLIENT_ID }],
      ['a non-string scope', { scopes: [1], clientId: CLIENT_ID }],
      ['an empty scope', { scopes: [''], clientId: CLIENT_ID }],
      ['a too long scope', { scopes: ['a'.repeat(65)], clientId: CLIENT_ID }],
      ['too many scopes', { scopes: Array.from({ length: 51 }, (_v, index) => `s${index}`), clientId: CLIENT_ID }],
      ['a non-string clientId', { scopes: ['repo'], clientId: 1 }],
      ['a malformed clientId', { scopes: ['repo'], clientId: 'bad id' }],
    ])('rejects %s', (_label, metadata) => {
      expect(() => built.strategy.describeMetadata(metadata)).toThrow(InvalidMetadataError);
    });
  });

  it('masks as gho_… plus the last 4 characters', () => {
    expect(built.strategy.mask(new Secret({ token: CANARY_OAUTH_TOKEN }))).toBe('gho_…e5f6');
  });

  describe('onDelete', () => {
    it('revokes this token only, through /applications/{client_id}/token', async () => {
      await built.strategy.onDelete(new Secret({ token: OTHER_TOKEN }), view());

      expect(built.github.revokedTokens).toEqual([OTHER_TOKEN]);
      expect(built.github.revokeCalls[0].clientId).toBe(CLIENT_ID);
      expect(built.github.revokeCalls[0].clientSecret.reveal()).toBe(CANARY_CLIENT_SECRET);
      expect(built.github.totalCallCount).toBe(1);
    });

    it('makes no call for an undecryptable row', async () => {
      await built.strategy.onDelete(null, view());

      expect(built.github.totalCallCount).toBe(0);
    });

    it('skips (and logs) while the type is disabled', async () => {
      const disabled = build({ enabled: false });

      await disabled.strategy.onDelete(new Secret({ token: OTHER_TOKEN }), view());

      expect(disabled.github.totalCallCount).toBe(0);
      expect(disabled.logger.info).toHaveBeenCalledWith('oauth app token revocation skipped', expect.objectContaining({
        reason: 'type_disabled',
        integrationUuid: view().uuid,
      }));
    });

    it.each([
      ['a different clientId', { scopes: ['repo'], clientId: OTHER_CLIENT_ID }],
      ['no clientId', { scopes: ['repo'] }],
    ])('skips (and logs) a token issued to %s', async (_label, metadata) => {
      await built.strategy.onDelete(new Secret({ token: OTHER_TOKEN }), view(metadata));

      expect(built.github.totalCallCount).toBe(0);
      expect(built.logger.info).toHaveBeenCalledWith('oauth app token revocation skipped', expect.objectContaining({
        reason: 'client_id_mismatch',
      }));
    });

    it.each([
      ['a 422', { status: 422 }, { githubStatus: 422 }],
      ['a network error', new GithubClientError('network_error'), { reason: 'network_error' }],
      ['an unexpected error', new Error(`boom ${CANARY_CLIENT_SECRET}`), { reason: 'unexpected_error' }],
    ])('swallows a failing revocation (%s), logging safe fields only', async (_label, answer, fields) => {
      built.github.revokeRespondWith(answer);

      await expect(built.strategy.onDelete(new Secret({ token: OTHER_TOKEN }), view())).resolves.toBeUndefined();
      expect(built.logger.warn).toHaveBeenCalledWith('oauth app token revocation failed', {
        type: 'oauth_app',
        integrationUuid: view().uuid,
        ...fields,
      });
    });
  });
});
