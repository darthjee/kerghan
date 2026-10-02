import { inspect } from 'node:util';
import { HttpException } from '@nestjs/common';
import { QueryFailedError } from 'typeorm';
import { GithubClientError } from '../github-client.service.js';
import { githubUserResponse } from './support/fake-github-client.js';
import {
  buildIntegrationsHarness,
  CANARY_CLASSIC,
  CANARY_FINE,
  CANARY_FRAGMENT,
  IntegrationsHarness,
} from './support/integrations-harness.js';

const USER = 7;

function envelope(overrides: Record<string, unknown> = {}): never {
  return { label: 'Work', provider: 'github', type: 'pat', credential: { token: CANARY_CLASSIC }, ...overrides } as never;
}

async function httpError(promise: Promise<unknown>): Promise<{ status: number; body: Record<string, unknown> }> {
  try {
    await promise;
  } catch (error) {
    expect(error).toBeInstanceOf(HttpException);
    const exception = error as HttpException;
    return { status: exception.getStatus(), body: exception.getResponse() as Record<string, unknown> };
  }

  throw new Error('expected an HttpException');
}

function expectNoCanary(value: unknown): void {
  expect(inspect(value, { depth: 10 })).not.toContain(CANARY_FRAGMENT);
  expect(JSON.stringify(value) ?? '').not.toContain(CANARY_FRAGMENT);
}

describe('IntegrationsService (create and replace credential)', () => {
  let harness: IntegrationsHarness;

  beforeEach(() => {
    harness = buildIntegrationsHarness();
  });

  afterEach(() => {
    expectNoCanary(harness.logger.warn.mock.calls);
    expectNoCanary(harness.logger.error.mock.calls);
    expectNoCanary(harness.logger.info.mock.calls);
    expectNoCanary(harness.repo.rows.map(({ metadata, secretHint, githubLogin, label }) => ({
      metadata,
      secretHint,
      githubLogin,
      label,
    })));
  });

  describe('create', () => {
    it('stores an active, encrypted integration and returns the allowlisted response', async () => {
      const response = await harness.service.create(USER, envelope());

      expect(response).toEqual({
        id: expect.stringMatching(/^[0-9a-f-]{36}$/),
        provider: 'github',
        type: 'pat',
        label: 'Work',
        status: 'active',
        statusReason: null,
        secretHint: 'ghp_…a1b2',
        githubLogin: 'octocat',
        metadata: { tokenKind: 'classic', scopes: ['read:org', 'repo'], permissionsVerified: true },
        expiresAt: null,
        lastTestedAt: expect.any(String),
        lastTestResult: 'success',
        createdAt: expect.any(String),
        updatedAt: expect.any(String),
      });
      expectNoCanary(response);

      const [row] = harness.repo.rows;
      expect(row).toMatchObject({ userId: USER, labelNormalized: 'work', status: 'active', uuid: response.id });
      expect(row.secretCiphertext.toString('utf8')).not.toContain(CANARY_FRAGMENT);
      expect(harness.encryption.decrypt({
        keyId: row.secretKeyId,
        iv: row.secretIv,
        authTag: row.secretAuthTag,
        ciphertext: row.secretCiphertext,
        uuid: row.uuid,
        type: row.type,
      })?.reveal()).toEqual({ token: CANARY_CLASSIC });
    });

    it('stores the expiry GitHub reports', async () => {
      harness.github.respondWith(githubUserResponse({ tokenExpiration: '2030-01-01 00:00:00 UTC' }));

      expect((await harness.service.create(USER, envelope())).expiresAt).toBe('2030-01-01T00:00:00.000Z');
    });

    it('answers 400 INTEGRATION_FLOW_UNSUPPORTED for a type with no credential-paste strategy, without a GitHub call', async () => {
      const { status, body } = await httpError(harness.service.create(USER, envelope({ type: 'oauth_app' })));

      expect(status).toBe(400);
      expect(body.code).toBe('INTEGRATION_FLOW_UNSUPPORTED');
      expect(harness.github.callCount).toBe(0);
    });

    it('answers 400 VALIDATION_FAILED for a bad credential, without echoing it', async () => {
      const { status, body } = await httpError(
        harness.service.create(USER, envelope({ credential: { token: `gho_${CANARY_FRAGMENT}` } })),
      );

      expect(status).toBe(400);
      expect(body.code).toBe('VALIDATION_FAILED');
      expectNoCanary(body);
      expect(harness.github.callCount).toBe(0);
    });

    it('answers 423 while the cool-off is active, without a GitHub call', async () => {
      harness.guard.state.set(USER, { failedAttempts: 5, lockedUntil: new Date(Date.now() + 60000) });

      const { status, body } = await httpError(harness.service.create(USER, envelope()));

      expect(status).toBe(423);
      expect(body.code).toBe('INTEGRATION_CREDENTIAL_LOCKED');
      expect(harness.github.callCount).toBe(0);
    });

    it('answers 409 INTEGRATIONS_LIMIT_REACHED on the 21st create (default cap), without a GitHub call', async () => {
      for (let index = 0; index < 20; index += 1) {
        await harness.service.create(USER, envelope({ label: `Work ${index}` }));
      }
      harness.github.reset();

      const { status, body } = await httpError(harness.service.create(USER, envelope({ label: 'One more' })));

      expect(status).toBe(409);
      expect(body.code).toBe('INTEGRATIONS_LIMIT_REACHED');
      expect(harness.github.callCount).toBe(0);
      expect(harness.repo.rows).toHaveLength(20);
    });

    it('reads the cap from config and counts every status', async () => {
      harness = buildIntegrationsHarness({ maxPerUser: 1 });
      await harness.service.create(USER, envelope());
      harness.repo.rows[0].status = 'invalid';

      expect((await httpError(harness.service.create(USER, envelope({ label: 'Other' })))).status).toBe(409);
      expect(await harness.service.create(8, envelope())).toMatchObject({ status: 'active' });
    });

    it('answers 409 INTEGRATION_LABEL_TAKEN for a case-insensitive duplicate, without a GitHub call', async () => {
      await harness.service.create(USER, envelope({ label: 'Work' }));
      harness.github.reset();

      const { status, body } = await httpError(harness.service.create(USER, envelope({ label: ' work ' })));

      expect(status).toBe(409);
      expect(body.code).toBe('INTEGRATION_LABEL_TAKEN');
      expect(harness.github.callCount).toBe(0);
    });

    it('allows the same label and the same GitHub identity for another user, fully isolated', async () => {
      const first = await harness.service.create(USER, envelope());
      const second = await harness.service.create(8, envelope());

      expect(second.githubLogin).toBe(first.githubLogin);
      expect(await harness.service.list(USER)).toHaveLength(1);
      expect(await harness.service.list(8)).toHaveLength(1);
    });

    it('allows the same GitHub identity twice for one user under different labels', async () => {
      await harness.service.create(USER, envelope({ label: 'A' }));
      await harness.service.create(USER, envelope({ label: 'B', credential: { token: CANARY_FINE } }));

      expect(await harness.service.list(USER)).toHaveLength(2);
    });

    it.each([
      ['a 401', githubUserResponse({ status: 401, login: null }), 422, 'INTEGRATION_CREDENTIAL_INVALID', 1],
      ['a classic token without repo', githubUserResponse({ oauthScopes: 'public_repo' }), 422, 'INTEGRATION_INSUFFICIENT_PERMISSIONS', 1],
      ['a 5xx', githubUserResponse({ status: 500, login: null }), 502, 'GITHUB_UNAVAILABLE', 0],
      ['a network error', new GithubClientError('network_error'), 502, 'GITHUB_UNAVAILABLE', 0],
      ['a rate limit', githubUserResponse({ status: 429, login: null, retryAfter: 12 }), 503, 'GITHUB_RATE_LIMITED', 0],
    ])('rejects %s, stores nothing and counts it only when counted', async (_label, answer, status, code, counted) => {
      harness.github.respondWith(answer);

      const error = await httpError(harness.service.create(USER, envelope()));

      expect(error.status).toBe(status);
      expect(error.body.code).toBe(code);
      expectNoCanary(error.body);
      expect(harness.repo.rows).toHaveLength(0);
      expect(harness.guard.state.get(USER)?.failedAttempts ?? 0).toBe(counted);
    });

    it('attaches the retry delay to a GitHub rate limit', async () => {
      harness.github.respondWith(githubUserResponse({ status: 429, login: null, retryAfter: 12 }));

      expect((await httpError(harness.service.create(USER, envelope()))).body.retryAfterSeconds).toBe(12);
    });

    it('trips the cool-off after 5 counted failures and resets it on success', async () => {
      harness.github.respondByDefault(githubUserResponse({ status: 401, login: null }));

      for (let index = 0; index < 5; index += 1) {
        expect((await httpError(harness.service.create(USER, envelope()))).status).toBe(422);
      }

      expect((await httpError(harness.service.create(USER, envelope()))).status).toBe(423);
      expect(harness.github.callCount).toBe(5);

      harness.guard.state.set(USER, { failedAttempts: 3, lockedUntil: null });
      harness.github.respondByDefault(githubUserResponse());
      await harness.service.create(USER, envelope());

      expect(harness.guard.state.get(USER)).toEqual({ failedAttempts: 0, lockedUntil: null });
    });

    it('counts concurrent failed creates', async () => {
      harness.github.respondByDefault(githubUserResponse({ status: 401, login: null }));

      await Promise.allSettled([1, 2, 3].map(() => harness.service.create(USER, envelope())));

      expect(harness.guard.state.get(USER)?.failedAttempts).toBe(3);
    });

    it('lets an unexpected (non-domain) validation error through, without counting it', async () => {
      harness.github.respondWith(new Error('boom'));

      await expect(harness.service.create(USER, envelope())).rejects.toThrow('boom');
      expect(harness.guard.state.has(USER)).toBe(false);
    });

    it.each([
      ['another database error', new QueryFailedError('INSERT', [], Object.assign(new Error('x'), { code: 'ER_LOCK' }))],
      ['a database error without a driver code', new QueryFailedError('INSERT', [], new Error('y'))],
      ['a non-database error', new Error('disk full')],
    ])('rethrows %s on insert', async (_label, failure) => {
      harness.repo.save = async () => {
        throw failure;
      };

      await expect(harness.service.create(USER, envelope())).rejects.toBe(failure);
    });

    it('answers 409 when a parallel create wins the label race', async () => {
      const repoSave = harness.repo.save;
      harness.repo.save = async (entity) => {
        harness.repo.save = repoSave;
        await repoSave({ ...entity, uuid: '99999999-9999-4999-8999-999999999999' });
        return repoSave(entity);
      };

      const { status, body } = await httpError(harness.service.create(USER, envelope()));

      expect(status).toBe(409);
      expect(body.code).toBe('INTEGRATION_LABEL_TAKEN');
    });
  });

  describe('replaceCredential', () => {
    let uuid: string;

    beforeEach(async () => {
      uuid = (await harness.service.create(USER, envelope())).id;
      const [row] = harness.repo.rows;
      Object.assign(row, { status: 'invalid', statusReason: 'bad_credentials', lastTestResult: 'rejected' });
      harness.github.reset();
    });

    it('re-encrypts with a fresh IV and refreshes identity, hint, metadata, status and test fields', async () => {
      const before = { ...harness.repo.rows[0] };
      harness.github.respondWith(githubUserResponse({ login: 'hubot', oauthScopes: null }));

      const response = await harness.service.replaceCredential(USER, uuid, { credential: { token: CANARY_FINE } });

      expect(response).toMatchObject({
        id: uuid,
        status: 'active',
        statusReason: null,
        githubLogin: 'hubot',
        secretHint: 'github_pat_…c3d4',
        metadata: { tokenKind: 'fine_grained', scopes: null, permissionsVerified: false },
        lastTestResult: 'success',
      });
      const [row] = harness.repo.rows;
      expect(row.secretIv.equals(before.secretIv)).toBe(false);
      expect(row.lastTestedAt).toBeInstanceOf(Date);
      expectNoCanary(response);
    });

    it.each([
      ['a rejection', githubUserResponse({ status: 401, login: null }), 422],
      ['a transient failure', githubUserResponse({ status: 503, login: null }), 502],
    ])('leaves the secret, metadata and status unchanged on %s', async (_label, answer, status) => {
      const before = { ...harness.repo.rows[0] };
      harness.github.respondWith(answer);

      expect((await httpError(
        harness.service.replaceCredential(USER, uuid, { credential: { token: CANARY_FINE } }),
      )).status).toBe(status);

      expect(harness.repo.rows[0]).toEqual(before);
    });

    it('answers 404 for a foreign uuid before validating the payload or the cool-off', async () => {
      harness.guard.state.set(8, { failedAttempts: 5, lockedUntil: new Date(Date.now() + 60000) });

      const { status } = await httpError(harness.service.replaceCredential(8, uuid, { credential: { bogus: 1 } }));

      expect(status).toBe(404);
      expect(harness.github.callCount).toBe(0);
    });

    it('answers 423 while locked out, without a GitHub call', async () => {
      harness.guard.state.set(USER, { failedAttempts: 5, lockedUntil: new Date(Date.now() + 60000) });

      const { status } = await httpError(
        harness.service.replaceCredential(USER, uuid, { credential: { token: CANARY_FINE } }),
      );

      expect(status).toBe(423);
      expect(harness.github.callCount).toBe(0);
    });

    it('brings an undecryptable row back to active', async () => {
      harness.repo.rows[0].secretKeyId = 'deadbeef';

      const response = await harness.service.replaceCredential(USER, uuid, { credential: { token: CANARY_CLASSIC } });

      expect(response.status).toBe('active');
      expect(harness.repo.rows[0].secretKeyId).toBe(harness.encryption.keyId);
    });
  });
});
