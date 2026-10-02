import { inspect } from 'node:util';
import { BadRequestException } from '@nestjs/common';
import { ErrorCodes } from '../../core/error-codes.js';
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
import { IntegrationView, ValidatedCredential } from '../types/integration-type-strategy.js';
import { FakeGithubClient, githubUserResponse } from './support/fake-github-client.js';
import { parseExpiration, parseScopes } from '../types/pat/pat-metadata.js';
import { PAT_REASON_BAD_CREDENTIALS, PatStrategy } from '../types/pat/pat.strategy.js';

const CLASSIC = 'ghp_CANARYcanary0000000000000000000000a1b2';
const FINE = 'github_pat_CANARYcanary00000000000000000c3d4';
const CANARY_FRAGMENT = 'CANARYcanary';

interface FakeLogger {
  warn: jest.Mock;
  error: jest.Mock;
  info: jest.Mock;
  debug: jest.Mock;
}

function view(overrides: Partial<IntegrationView> = {}): IntegrationView {
  return {
    uuid: '11111111-1111-4111-8111-111111111111',
    type: 'pat',
    status: 'active',
    statusReason: null,
    githubLogin: 'octocat',
    expiresAt: null,
    metadata: { tokenKind: 'classic', scopes: ['repo'], permissionsVerified: true },
    ...overrides,
  };
}

async function thrown(promise: Promise<unknown>): Promise<Error> {
  try {
    await promise;
  } catch (error) {
    return error as Error;
  }

  throw new Error('expected a rejection');
}

function thrownSync(fn: () => unknown): Error {
  try {
    fn();
  } catch (error) {
    return error as Error;
  }

  throw new Error('expected a throw');
}

function expectNoCanary(value: unknown): void {
  expect(JSON.stringify(value) ?? '').not.toContain(CANARY_FRAGMENT);
  expect(inspect(value, { depth: 10 })).not.toContain(CANARY_FRAGMENT);
}

describe('PatStrategy', () => {
  let github: FakeGithubClient;
  let logger: FakeLogger;
  let strategy: PatStrategy;

  beforeEach(() => {
    github = new FakeGithubClient();
    logger = { warn: jest.fn(), error: jest.fn(), info: jest.fn(), debug: jest.fn() };
    strategy = new PatStrategy(github as unknown as GithubClientService, logger as unknown as LoggerService);
  });

  afterEach(() => {
    expectNoCanary(logger.warn.mock.calls);
    expectNoCanary(logger.error.mock.calls);
    expectNoCanary(logger.info.mock.calls);
    expectNoCanary(logger.debug.mock.calls);
  });

  it('is a credential-paste-only type', () => {
    expect(strategy.type).toBe('pat');
    expect(strategy.flows).toEqual({ credentialPaste: true, redirect: false });
  });

  describe('parseCredential', () => {
    it.each([
      ['a classic token', CLASSIC],
      ['a fine-grained token', FINE],
    ])('accepts %s', (_label, token) => {
      const secret = strategy.parseCredential({ token });

      expect(secret).toBeInstanceOf(Secret);
      expect(secret.reveal()).toEqual({ token });
    });

    it('trims surrounding whitespace', () => {
      expect(strategy.parseCredential({ token: `  ${CLASSIC}\n` }).reveal()).toEqual({ token: CLASSIC });
    });

    it.each([
      ['an oauth token prefix', { token: 'gho_CANARYcanary00000000000000000000' }, 'personal access token'],
      ['a legacy 40-hex token', { token: 'CANARYcanary0123456789abcdef0123456789ab' }, 'personal access token'],
      ['an empty token', { token: '   ' }, 'between 1 and 255'],
      ['a too long token', { token: `ghp_${CANARY_FRAGMENT}${'a'.repeat(250)}` }, 'between 1 and 255'],
      ['a bad character', { token: `ghp_${CANARY_FRAGMENT}-x` }, 'letters, digits and underscores'],
      ['a non-string token', { token: 1234 }, 'must be a string'],
      ['a missing token', {}, 'exactly one field'],
      ['an unknown credential field', { token: CLASSIC, extra: CANARY_FRAGMENT }, 'exactly one field'],
      ['a non-object credential', CLASSIC, 'must be an object'],
      ['an array credential', [CLASSIC], 'must be an object'],
      ['a null credential', null, 'must be an object'],
    ])('rejects %s with VALIDATION_FAILED, without echoing the value', (_label, raw, message) => {
      const error = thrownSync(() => strategy.parseCredential(raw));

      expect(error).toBeInstanceOf(BadRequestException);
      const response = (error as BadRequestException).getResponse() as { code: string; message: string[] };
      expect(response.code).toBe(ErrorCodes.VALIDATION_FAILED);
      expect(response.message.join(' ')).toContain(message);
      expectNoCanary(response);
      expect(error.message).not.toContain(CANARY_FRAGMENT);
    });
  });

  describe('parseSecretPayload', () => {
    it('accepts a { token } payload', () => {
      expect(strategy.parseSecretPayload(new Secret({ token: CLASSIC }))?.reveal()).toEqual({ token: CLASSIC });
    });

    it.each([
      ['a string', CLASSIC],
      ['an extra key', { token: CLASSIC, other: 1 }],
      ['a bad token', { token: 'nope' }],
      ['null', null],
    ])('answers null for %s', (_label, payload) => {
      expect(strategy.parseSecretPayload(new Secret(payload))).toBeNull();
    });
  });

  describe('validate', () => {
    it('accepts a classic token with repo, with its parsed scopes', async () => {
      github.respondWith(githubUserResponse({ oauthScopes: 'read:org, repo,repo , ,gist' }));

      const result = await strategy.validate(new Secret({ token: CLASSIC }));

      expect(result.githubLogin).toBe('octocat');
      expect(result.expiresAt).toBeNull();
      expect(result.metadata).toEqual({
        tokenKind: 'classic',
        scopes: ['gist', 'read:org', 'repo'],
        permissionsVerified: true,
      });
      expect(result.secret.reveal()).toEqual({ token: CLASSIC });
      expect(github.callCount).toBe(1);
      expect(github.calls[0].reveal()).toBe(CLASSIC);
      expectNoCanary(result.metadata);
    });

    it.each([
      ['public_repo only', 'public_repo'],
      ['an empty header', ''],
      ['no header', null],
    ])('rejects a classic token with %s as insufficient permissions', async (_label, oauthScopes) => {
      github.respondWith(githubUserResponse({ oauthScopes }));

      const error = await thrown(strategy.validate(new Secret({ token: CLASSIC })));

      expect(error).toBeInstanceOf(InsufficientPermissionsError);
      expect((error as InsufficientPermissionsError).countsTowardCoolOff).toBe(true);
      expectNoCanary(error);
    });

    it('accepts a fine-grained token with unverified permissions, whatever the headers', async () => {
      github.respondWith(githubUserResponse({ oauthScopes: 'public_repo' }));

      const result = await strategy.validate(new Secret({ token: FINE }));

      expect(result.metadata).toEqual({ tokenKind: 'fine_grained', scopes: null, permissionsVerified: false });
    });

    it('rejects a 401 as an invalid credential', async () => {
      github.respondWith(githubUserResponse({ status: 401, login: null }));

      const error = await thrown(strategy.validate(new Secret({ token: CLASSIC })));

      expect(error).toBeInstanceOf(CredentialInvalidError);
      expect((error as CredentialInvalidError).countsTowardCoolOff).toBe(true);
      expectNoCanary(error);
    });

    it.each([
      ['a 403 with remaining 0 and a reset', 403, { rateLimitRemaining: 0, rateLimitReset: 1000 }, 100],
      ['a 429 with retry-after', 429, { retryAfter: 60 }, 60],
      ['a 403 with retry-after and a reset', 403, { retryAfter: 7, rateLimitReset: 5000 }, 7],
      ['a 429 with remaining 0 and no reset', 429, { rateLimitRemaining: 0 }, undefined],
      ['a 403 with a reset in the past', 403, { rateLimitRemaining: 0, rateLimitReset: 1 }, 0],
    ])('maps %s to a rate limit', async (_label, status, headers, retryAfterSeconds) => {
      jest.spyOn(Date, 'now').mockReturnValue(900_000);
      github.respondWith(githubUserResponse({ status, login: null, rateLimitRemaining: 10, ...headers }));

      const error = await thrown(strategy.validate(new Secret({ token: CLASSIC })));

      expect(error).toBeInstanceOf(GithubRateLimitedError);
      expect((error as GithubRateLimitedError).retryAfterSeconds).toBe(retryAfterSeconds);
      expect((error as GithubRateLimitedError).countsTowardCoolOff).toBe(false);
      jest.restoreAllMocks();
    });

    it.each([
      ['a 5xx', githubUserResponse({ status: 502, login: null })],
      ['a 403 without rate-limit headers', githubUserResponse({ status: 403, login: null })],
      ['an unexpected status', githubUserResponse({ status: 404, login: null })],
      ['a 200 without login', githubUserResponse({ login: null })],
      ['a network error', new GithubClientError('network_error')],
      ['a timeout', new GithubClientError('timeout')],
    ])('maps %s to unavailable', async (_label, answer) => {
      github.respondWith(answer);

      const error = await thrown(strategy.validate(new Secret({ token: CLASSIC })));

      expect(error).toBeInstanceOf(GithubUnavailableError);
      expect((error as GithubUnavailableError).countsTowardCoolOff).toBe(false);
    });

    it('lets an unexpected (non-client) error through', async () => {
      github.respondWith(new Error('boom'));

      await expect(strategy.validate(new Secret({ token: CLASSIC }))).rejects.toThrow('boom');
    });
  });

  describe('expiry', () => {
    async function expiresAtFor(tokenExpiration: string | null): Promise<Date | null> {
      github.respondWith(githubUserResponse({ tokenExpiration }));
      const result: ValidatedCredential = await strategy.validate(new Secret({ token: CLASSIC }));
      return result.expiresAt;
    }

    it('parses the UTC form', async () => {
      expect((await expiresAtFor('2026-11-01 00:00:00 UTC'))?.toISOString()).toBe('2026-11-01T00:00:00.000Z');
    });

    it('parses the numeric-offset form into UTC', async () => {
      expect((await expiresAtFor('2026-11-01 00:00:00 -0800'))?.toISOString()).toBe('2026-11-01T08:00:00.000Z');
    });

    it('answers null when the header is absent', async () => {
      expect(await expiresAtFor(null)).toBeNull();
      expect(logger.warn).not.toHaveBeenCalled();
    });

    it('answers null and warns with safe fields when unparseable', async () => {
      expect(await expiresAtFor('next tuesday')).toBeNull();
      expect(logger.warn).toHaveBeenCalledWith('unparseable GitHub token expiration header', {
        type: 'pat',
        githubLogin: 'octocat',
      });
    });

    it('treats an impossible date as unparseable', () => {
      expect(parseExpiration('2026-13-45 99:00:00 UTC')).toBeUndefined();
      expect(parseExpiration('  ')).toBeNull();
    });
  });

  describe('test', () => {
    it('answers active with refreshed data for a classic token with repo', async () => {
      github.respondWith(githubUserResponse({ login: 'hubot', tokenExpiration: '2030-01-01 00:00:00 UTC' }));

      expect(await strategy.test(new Secret({ token: CLASSIC }), view())).toEqual({
        kind: 'active',
        githubLogin: 'hubot',
        expiresAt: new Date('2030-01-01T00:00:00.000Z'),
        metadata: { tokenKind: 'classic', scopes: ['read:org', 'repo'], permissionsVerified: true },
      });
    });

    it('answers active for a fine-grained token', async () => {
      github.respondWith(githubUserResponse({ oauthScopes: null }));

      expect(await strategy.test(new Secret({ token: FINE }), view())).toMatchObject({ kind: 'active' });
    });

    it('answers invalid + insufficient_permissions for a classic token that lost repo', async () => {
      github.respondWith(githubUserResponse({ oauthScopes: 'public_repo' }));

      expect(await strategy.test(new Secret({ token: CLASSIC }), view()))
        .toEqual({ kind: 'invalid', reason: 'insufficient_permissions' });
    });

    it('answers expired for a 401 with a past expiresAt', async () => {
      github.respondWith(githubUserResponse({ status: 401, login: null }));

      expect(await strategy.test(new Secret({ token: CLASSIC }), view({ expiresAt: new Date('2000-01-01') })))
        .toEqual({ kind: 'expired' });
    });

    it.each([
      ['a future', new Date('2999-01-01')],
      ['a null', null],
    ])('answers invalid + bad_credentials for a 401 with %s expiresAt', async (_label, expiresAt) => {
      github.respondWith(githubUserResponse({ status: 401, login: null }));

      expect(await strategy.test(new Secret({ token: CLASSIC }), view({ expiresAt })))
        .toEqual({ kind: 'invalid', reason: PAT_REASON_BAD_CREDENTIALS });
    });

    it('answers transient rate_limited with the retry delay', async () => {
      github.respondWith(githubUserResponse({ status: 429, login: null, retryAfter: 30 }));

      expect(await strategy.test(new Secret({ token: CLASSIC }), view()))
        .toEqual({ kind: 'transient', error: 'rate_limited', retryAfterSeconds: 30 });
    });

    it.each([
      ['a 5xx', githubUserResponse({ status: 500, login: null })],
      ['an unexpected status', githubUserResponse({ status: 418, login: null })],
      ['a network error', new GithubClientError('network_error')],
      ['a timeout', new GithubClientError('timeout')],
    ])('answers transient unavailable for %s', async (_label, answer) => {
      github.respondWith(answer);

      expect(await strategy.test(new Secret({ token: CLASSIC }), view()))
        .toEqual({ kind: 'transient', error: 'unavailable' });
    });
  });

  describe('describeMetadata', () => {
    it.each([
      [{ tokenKind: 'classic', scopes: ['repo'], permissionsVerified: true }],
      [{ tokenKind: 'classic', scopes: [], permissionsVerified: true }],
      [{ tokenKind: 'fine_grained', scopes: null, permissionsVerified: false }],
    ])('accepts %p', (metadata) => {
      expect(strategy.describeMetadata(metadata)).toEqual(metadata);
    });

    it.each([
      ['an extra key', { tokenKind: 'classic', scopes: ['repo'], permissionsVerified: true, token: 'x' }],
      ['a missing key', { tokenKind: 'classic', scopes: ['repo'] }],
      ['classic with null scopes', { tokenKind: 'classic', scopes: null, permissionsVerified: true }],
      ['classic unverified', { tokenKind: 'classic', scopes: ['repo'], permissionsVerified: false }],
      ['fine-grained with scopes', { tokenKind: 'fine_grained', scopes: ['repo'], permissionsVerified: false }],
      ['fine-grained verified', { tokenKind: 'fine_grained', scopes: null, permissionsVerified: true }],
      ['an unknown kind', { tokenKind: 'oauth', scopes: null, permissionsVerified: false }],
      ['a non-string scope', { tokenKind: 'classic', scopes: [1], permissionsVerified: true }],
      ['a string scopes', { tokenKind: 'classic', scopes: 'repo', permissionsVerified: true }],
      ['a non-boolean flag', { tokenKind: 'classic', scopes: ['repo'], permissionsVerified: 'yes' }],
      ['an array', []],
      ['null', null],
    ])('rejects %s', (_label, metadata) => {
      expect(() => strategy.describeMetadata(metadata)).toThrow(InvalidMetadataError);
    });
  });

  describe('scope parsing', () => {
    it('drops over-long entries and keeps at most 50 scopes', () => {
      const many = Array.from({ length: 60 }, (_, index) => `scope${String(index).padStart(2, '0')}`);

      expect(parseScopes(`${'x'.repeat(65)},repo`)).toEqual(['repo']);
      expect(parseScopes(many.join(','))).toHaveLength(50);
    });
  });

  describe('mask', () => {
    it.each([
      [CLASSIC, 'ghp_…a1b2'],
      [FINE, 'github_pat_…c3d4'],
    ])('masks %s', (token, hint) => {
      const masked = strategy.mask(new Secret({ token }));

      expect(masked).toBe(hint);
      expect(masked).not.toContain(CANARY_FRAGMENT);
      expect(masked.length).toBeLessThanOrEqual(64);
    });
  });

  describe('onDelete', () => {
    it.each([
      ['a decryptable row', new Secret({ token: CLASSIC })],
      ['an undecryptable row', null],
    ])('makes no GitHub call for %s', async (_label, secret) => {
      await expect(strategy.onDelete(secret, view())).resolves.toBeUndefined();
      expect(github.callCount).toBe(0);
    });
  });
});
