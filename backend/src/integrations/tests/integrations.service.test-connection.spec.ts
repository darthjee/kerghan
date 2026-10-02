import { inspect } from 'node:util';
import { HttpException } from '@nestjs/common';
import { GithubClientError } from '../github-client.service.js';
import { githubUserResponse } from './support/fake-github-client.js';
import {
  buildIntegrationsHarness,
  CANARY_CLASSIC,
  CANARY_FRAGMENT,
  IntegrationsHarness,
} from './support/integrations-harness.js';

const USER = 7;

async function httpError(promise: Promise<unknown>): Promise<{ status: number; body: Record<string, unknown> }> {
  try {
    await promise;
  } catch (error) {
    const exception = error as HttpException;
    return { status: exception.getStatus(), body: exception.getResponse() as Record<string, unknown> };
  }

  throw new Error('expected an HttpException');
}

describe('IntegrationsService (test connection)', () => {
  let harness: IntegrationsHarness;
  let uuid: string;

  beforeEach(async () => {
    harness = buildIntegrationsHarness();
    uuid = (await harness.service.create(USER, {
      label: 'Work',
      provider: 'github',
      type: 'pat',
      credential: { token: CANARY_CLASSIC },
    } as never)).id;
    harness.repo.rows[0].lastTestedAt = null;
    harness.github.reset();
  });

  afterEach(() => {
    expect(inspect(harness.logger.warn.mock.calls, { depth: 10 })).not.toContain(CANARY_FRAGMENT);
  });

  it('keeps an accepted credential active and refreshes its data', async () => {
    harness.repo.rows[0].statusReason = null;
    harness.github.respondWith(githubUserResponse({ login: 'hubot', tokenExpiration: '2030-01-01 00:00:00 UTC' }));

    const response = await harness.service.test(USER, uuid);

    expect(response).toMatchObject({
      status: 'active',
      statusReason: null,
      githubLogin: 'hubot',
      expiresAt: '2030-01-01T00:00:00.000Z',
      lastTestResult: 'success',
      lastTestedAt: expect.any(String),
    });
    expect(harness.github.callCount).toBe(1);
    expect(JSON.stringify(response)).not.toContain(CANARY_FRAGMENT);
  });

  it('marks a rejected credential invalid with its reason (a successful test)', async () => {
    harness.github.respondWith(githubUserResponse({ status: 401, login: null }));

    expect(await harness.service.test(USER, uuid)).toMatchObject({
      status: 'invalid',
      statusReason: 'bad_credentials',
      lastTestResult: 'rejected',
    });
  });

  it('marks a classic token that lost repo invalid + insufficient_permissions', async () => {
    harness.github.respondWith(githubUserResponse({ oauthScopes: 'public_repo' }));

    expect(await harness.service.test(USER, uuid)).toMatchObject({
      status: 'invalid',
      statusReason: 'insufficient_permissions',
      lastTestResult: 'rejected',
    });
  });

  it('marks a 401 past the known expiry as expired, clearing the reason', async () => {
    Object.assign(harness.repo.rows[0], { expiresAt: new Date('2000-01-01T00:00:00Z'), statusReason: 'stale' });
    harness.github.respondWith(githubUserResponse({ status: 401, login: null }));

    const response = await harness.service.test(USER, uuid);

    expect(response).toMatchObject({ status: 'expired', statusReason: null, lastTestResult: 'rejected' });
    expect(harness.repo.rows[0]).toMatchObject({ status: 'expired', statusReason: null });
  });

  it('brings an invalid row back to active when GitHub accepts it again', async () => {
    Object.assign(harness.repo.rows[0], { status: 'invalid', statusReason: 'bad_credentials' });

    expect(await harness.service.test(USER, uuid)).toMatchObject({ status: 'active', statusReason: null });
  });

  it.each([
    ['a 5xx', githubUserResponse({ status: 500, login: null }), 502, 'GITHUB_UNAVAILABLE'],
    ['a network error', new GithubClientError('timeout'), 502, 'GITHUB_UNAVAILABLE'],
    ['a rate limit', githubUserResponse({ status: 403, login: null, rateLimitRemaining: 0 }), 503, 'GITHUB_RATE_LIMITED'],
  ])('records %s as transient_error, leaves the status unchanged and answers the upstream error', async (
    _label,
    answer,
    status,
    code,
  ) => {
    Object.assign(harness.repo.rows[0], { status: 'invalid', statusReason: 'bad_credentials' });
    harness.github.respondWith(answer);

    const error = await httpError(harness.service.test(USER, uuid));

    expect(error.status).toBe(status);
    expect(error.body.code).toBe(code);
    expect(harness.repo.rows[0]).toMatchObject({
      status: 'invalid',
      statusReason: 'bad_credentials',
      lastTestResult: 'transient_error',
    });
    expect(harness.repo.rows[0].lastTestedAt).toBeInstanceOf(Date);
  });

  it('passes GitHub\'s retry delay on a rate limit', async () => {
    harness.github.respondWith(githubUserResponse({ status: 429, login: null, retryAfter: 42 }));

    expect((await httpError(harness.service.test(USER, uuid))).body.retryAfterSeconds).toBe(42);
  });

  it('answers 429 with the remaining seconds inside the cooldown, without a GitHub call', async () => {
    await harness.service.test(USER, uuid);
    harness.github.reset();

    const { status, body } = await httpError(harness.service.test(USER, uuid));

    expect(status).toBe(429);
    expect(body).toMatchObject({ code: 'INTEGRATION_TEST_COOLDOWN', retryAfterSeconds: 30 });
    expect(harness.github.callCount).toBe(0);
  });

  it('makes a single GitHub call for concurrent tests', async () => {
    const results = await Promise.allSettled([1, 2, 3].map(() => harness.service.test(USER, uuid)));

    expect(results.filter((result) => result.status === 'fulfilled')).toHaveLength(1);
    expect(harness.github.callCount).toBe(1);
  });

  it('answers 404 for a foreign uuid, even while it is in its cooldown', async () => {
    harness.repo.rows[0].lastTestedAt = new Date();

    expect((await httpError(harness.service.test(8, uuid))).status).toBe(404);
  });

  it('marks a key-id mismatch undecryptable without calling GitHub', async () => {
    harness.repo.rows[0].secretKeyId = 'deadbeef';

    const response = await harness.service.test(USER, uuid);

    expect(response).toMatchObject({ status: 'undecryptable', secretHint: null, lastTestResult: 'undecryptable' });
    expect(harness.repo.rows[0].status).toBe('undecryptable');
    expect(harness.github.callCount).toBe(0);
  });

  it('marks a tampered ciphertext undecryptable without calling GitHub', async () => {
    const row = harness.repo.rows[0];
    row.secretCiphertext = Buffer.from(row.secretCiphertext.map((byte) => byte ^ 0xff));

    expect((await harness.service.test(USER, uuid)).status).toBe('undecryptable');
    expect(harness.github.callCount).toBe(0);
  });

  it('marks a payload that no longer matches the type shape undecryptable', async () => {
    const row = harness.repo.rows[0];
    const { Secret } = await import('../secret.js');
    Object.assign(row, (({ keyId, iv, authTag, ciphertext }) => ({
      secretKeyId: keyId,
      secretIv: iv,
      secretAuthTag: authTag,
      secretCiphertext: ciphertext,
    }))(harness.encryption.encrypt(new Secret({ nope: true }), { uuid: row.uuid, type: row.type })));

    expect((await harness.service.test(USER, uuid)).status).toBe('undecryptable');
  });

  it('recovers a stored undecryptable row whose key id matches again', async () => {
    harness.repo.rows[0].status = 'undecryptable';

    expect(await harness.service.test(USER, uuid)).toMatchObject({ status: 'active', lastTestResult: 'success' });
    expect(harness.github.callCount).toBe(1);
  });
});
