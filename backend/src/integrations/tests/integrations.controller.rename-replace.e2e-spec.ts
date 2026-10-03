import { call, createIntegration, expectSafeBody, TEST_COOLDOWN_MS, useIntegrationsTestApp } from './support/build-integrations-test-app.js';
import { githubUserResponse } from './support/fake-github-client.js';
import { CANARY_CLASSIC, CANARY_FINE, CANARY_FRAGMENT } from './support/integrations-harness.js';
import { expectErrorBody, expectValidationErrorBody } from '../../auth/tests/support/error-body.js';

describe('IntegrationsController rename and replace credential (e2e)', () => {
  const { ctx } = useIntegrationsTestApp();
  let id: string;

  beforeEach(async () => {
    id = (await createIntegration(ctx, ctx.owner)).body.id;
    ctx.github.reset();
  });

  describe('PATCH /integrations/:uuid.json', () => {
    it('renames, trimming the label and keeping the status', async () => {
      ctx.repo.rows[0].status = 'invalid';
      ctx.repo.rows[0].statusReason = 'bad_credentials';

      const response = await call(ctx.app, 'patch', `/integrations/${id}.json`, ctx.owner)
        .send({ label: '  Personal ' })
        .expect(200);

      expect(response.body).toMatchObject({ id, label: 'Personal', status: 'invalid', statusReason: 'bad_credentials' });
      expectSafeBody(response.body);
    });

    it('keeps nextTestAt, derived from the unchanged lastTestedAt', async () => {
      ctx.repo.rows[0].lastTestedAt = new Date('2026-01-01T12:00:00Z');

      const response = await call(ctx.app, 'patch', `/integrations/${id}.json`, ctx.owner).send({ label: 'Personal' }).expect(200);

      expect(response.body).toMatchObject({
        lastTestedAt: '2026-01-01T12:00:00.000Z',
        nextTestAt: new Date(Date.parse('2026-01-01T12:00:00Z') + TEST_COOLDOWN_MS).toISOString(),
      });
    });

    it('answers a null nextTestAt when never tested', async () => {
      ctx.repo.rows[0].lastTestedAt = null;

      const response = await call(ctx.app, 'patch', `/integrations/${id}.json`, ctx.owner).send({ label: 'Personal' }).expect(200);

      expect(response.body).toMatchObject({ lastTestedAt: null, nextTestAt: null });
    });

    it('allows the same label with a different case', async () => {
      await call(ctx.app, 'patch', `/integrations/${id}.json`, ctx.owner).send({ label: 'WORK' }).expect(200);
    });

    it('answers 409 for another integration\'s label', async () => {
      await createIntegration(ctx, ctx.owner, { label: 'Home' });

      expectErrorBody(
        await call(ctx.app, 'patch', `/integrations/${id}.json`, ctx.owner).send({ label: 'home' }),
        { status: 409, code: 'INTEGRATION_LABEL_TAKEN' },
      );
    });

    it.each([
      ['blank', '  '],
      ['too long', 'x'.repeat(101)],
      ['not a string', 12],
    ])('answers 400 for a %s label', async (_label, label) => {
      expectValidationErrorBody(await call(ctx.app, 'patch', `/integrations/${id}.json`, ctx.owner).send({ label }));
    });
  });

  describe('POST /integrations/:uuid/credential.json', () => {
    it('replaces the credential and answers 200 with the refreshed integration', async () => {
      ctx.repo.rows[0].status = 'invalid';
      ctx.github.respondWith(githubUserResponse({ login: 'hubot' }));

      const response = await call(ctx.app, 'post', `/integrations/${id}/credential.json`, ctx.owner)
        .send({ credential: { token: CANARY_FINE } })
        .expect(200);

      expect(response.body).toMatchObject({
        id,
        status: 'active',
        statusReason: null,
        githubLogin: 'hubot',
        secretHint: 'github_pat_…c3d4',
        lastTestResult: 'success',
      });
      expect(Date.parse(response.body.nextTestAt) - Date.parse(response.body.lastTestedAt)).toBe(TEST_COOLDOWN_MS);
      expectSafeBody(response.body);
    });

    it.each([
      ['a 401', githubUserResponse({ status: 401, login: null }), 422, 'INTEGRATION_CREDENTIAL_INVALID'],
      ['missing repo', githubUserResponse({ oauthScopes: '' }), 422, 'INTEGRATION_INSUFFICIENT_PERMISSIONS'],
      ['a 5xx', githubUserResponse({ status: 500, login: null }), 502, 'GITHUB_UNAVAILABLE'],
      ['a rate limit', githubUserResponse({ status: 403, login: null, rateLimitRemaining: 0 }), 503, 'GITHUB_RATE_LIMITED'],
    ])('leaves the row unchanged on %s', async (_label, answer, status, code) => {
      const before = { ...ctx.repo.rows[0] };
      ctx.github.respondWith(answer);

      const response = await call(ctx.app, 'post', `/integrations/${id}/credential.json`, ctx.owner)
        .send({ credential: { token: CANARY_CLASSIC } });

      expectErrorBody(response, { status, code });
      expect(ctx.repo.rows[0]).toEqual(before);
    });

    it('answers 400 for an invalid credential, without echoing it', async () => {
      const response = await call(ctx.app, 'post', `/integrations/${id}/credential.json`, ctx.owner)
        .send({ credential: { token: `nope_${CANARY_FRAGMENT}` } });

      expectValidationErrorBody(response);
      expect(JSON.stringify(response.body)).not.toContain(CANARY_FRAGMENT);
    });

    it('answers 423 while the cool-off is active', async () => {
      ctx.guard.state.set(ctx.userRepo.rows[0].id, { failedAttempts: 9, lockedUntil: new Date(Date.now() + 60000) });

      expectErrorBody(
        await call(ctx.app, 'post', `/integrations/${id}/credential.json`, ctx.owner).send({ credential: { token: CANARY_FINE } }),
        { status: 423, code: 'INTEGRATION_CREDENTIAL_LOCKED' },
      );
      expect(ctx.github.callCount).toBe(0);
    });

    it.each(['oauth_app', 'github_app'])('answers 400 INTEGRATION_FLOW_UNSUPPORTED for a %s row (no credential-paste flow)', async (type) => {
      ctx.repo.rows[0].type = type;

      expectErrorBody(
        await call(ctx.app, 'post', `/integrations/${id}/credential.json`, ctx.owner).send({ credential: { token: CANARY_FINE } }),
        { status: 400, code: 'INTEGRATION_FLOW_UNSUPPORTED' },
      );
    });
  });
});
