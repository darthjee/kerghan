import { expectErrorBody } from '../../auth/tests/support/error-body.js';
import { GithubClientError } from '../github-client.service.js';
import { call, createIntegration, expectSafeBody, useIntegrationsTestApp } from './support/build-integrations-test-app.js';
import { githubUserResponse } from './support/fake-github-client.js';

describe('IntegrationsController test connection and delete (e2e)', () => {
  const { ctx } = useIntegrationsTestApp();
  let id: string;

  beforeEach(async () => {
    id = (await createIntegration(ctx, ctx.owner)).body.id;
    ctx.repo.rows[0].lastTestedAt = null;
    ctx.github.reset();
  });

  function test(): ReturnType<typeof call> {
    return call(ctx.app, 'post', `/integrations/${id}/test.json`, ctx.owner);
  }

  describe('POST /integrations/:uuid/test.json', () => {
    it('answers 200 active when GitHub accepts the token', async () => {
      const response = await test().expect(200);

      expect(response.body).toMatchObject({ id, status: 'active', lastTestResult: 'success' });
      expectSafeBody(response.body);
    });

    it('answers 200 invalid + bad_credentials when GitHub rejects it', async () => {
      ctx.github.respondWith(githubUserResponse({ status: 401, login: null }));

      const response = await test().expect(200);

      expect(response.body).toMatchObject({ status: 'invalid', statusReason: 'bad_credentials', lastTestResult: 'rejected' });
    });

    it('answers 200 expired for a 401 past the known expiry', async () => {
      ctx.repo.rows[0].expiresAt = new Date('2000-01-01T00:00:00Z');
      ctx.github.respondWith(githubUserResponse({ status: 401, login: null }));

      expect((await test().expect(200)).body).toMatchObject({ status: 'expired', lastTestResult: 'rejected' });
    });

    it.each([
      ['unreachable', new GithubClientError('network_error'), 502, 'GITHUB_UNAVAILABLE'],
      ['5xx', githubUserResponse({ status: 503, login: null }), 502, 'GITHUB_UNAVAILABLE'],
      ['rate limited', githubUserResponse({ status: 429, login: null, retryAfter: 5 }), 503, 'GITHUB_RATE_LIMITED'],
    ])('answers a transient GitHub failure (%s) with %i, leaving the status unchanged', async (_label, answer, status, code) => {
      ctx.github.respondWith(answer);

      expectErrorBody(await test(), { status, code });
      expect(ctx.repo.rows[0]).toMatchObject({ status: 'active', lastTestResult: 'transient_error' });
    });

    it('sends Retry-After with a GitHub rate limit', async () => {
      ctx.github.respondWith(githubUserResponse({ status: 429, login: null, retryAfter: 5 }));

      expect((await test()).headers['retry-after']).toBe('5');
    });

    it('answers 429 INTEGRATION_TEST_COOLDOWN with Retry-After inside the cooldown, without a GitHub call', async () => {
      await test().expect(200);
      ctx.github.reset();

      const response = await test();

      expectErrorBody(response, { status: 429, code: 'INTEGRATION_TEST_COOLDOWN' });
      expect(Number(response.headers['retry-after'])).toBeGreaterThanOrEqual(1);
      expect(Number(response.headers['retry-after'])).toBeLessThanOrEqual(30);
      expect(ctx.github.callCount).toBe(0);
    });

    it('makes a single GitHub call for concurrent tests', async () => {
      const statuses = (await Promise.all([test(), test(), test()])).map((response) => response.status).sort();

      expect(statuses).toEqual([200, 429, 429]);
      expect(ctx.github.callCount).toBe(1);
    });

    it('answers 200 undecryptable without calling GitHub when the key id does not match', async () => {
      ctx.repo.rows[0].secretKeyId = 'deadbeef';

      expect((await test().expect(200)).body).toMatchObject({ status: 'undecryptable', secretHint: null });
      expect(ctx.github.callCount).toBe(0);
    });
  });

  describe('DELETE /integrations/:uuid.json', () => {
    it('answers 204 and removes the row, without a GitHub call', async () => {
      const response = await call(ctx.app, 'delete', `/integrations/${id}.json`, ctx.owner).expect(204);

      expect(response.body).toEqual({});
      expect(ctx.repo.rows).toHaveLength(0);
      expect(ctx.github.callCount).toBe(0);
    });

    it('deletes an undecryptable row', async () => {
      ctx.repo.rows[0].secretKeyId = 'deadbeef';

      await call(ctx.app, 'delete', `/integrations/${id}.json`, ctx.owner).expect(204);

      expect(ctx.repo.rows).toHaveLength(0);
    });
  });
});
