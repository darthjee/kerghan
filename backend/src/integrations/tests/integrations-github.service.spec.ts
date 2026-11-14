import { inspect } from 'node:util';
import type { Integration } from '../entities/integration.entity.js';
import { githubAppTestKey } from './support/github-app-test-key.js';
import {
  forbidden,
  githubRepo,
  jsonResponse,
  listingPage,
  notFound,
  rateLimited,
  redirect,
  replyOnce,
  repository,
  serverError,
  timeout,
  unauthorized,
} from './support/github-builders.js';
import {
  buildGithubServiceHarness,
  CANARY,
  CANARY_INSTALLATION_TOKEN,
  CANARY_OAUTH_TOKEN,
  CANARY_PAT,
  GithubServiceHarness,
  START,
} from './support/integrations-github-harness.js';
import { deferred, fetchCalls, fetchMock, installNoNetworkGuard } from './support/no-network-guard.js';

const USER = 1;
const INTRUDER = 2;

/**
 * The mint's `201`.
 * @returns {Response} The response.
 */
function minted(): Response {
  return jsonResponse(201, { token: CANARY_INSTALLATION_TOKEN, expires_at: new Date(START.getTime() + 3_600_000).toISOString() });
}

/**
 * The stored row.
 * @param {GithubServiceHarness} harness - The harness.
 * @param {Integration} row - A seeded row.
 * @returns {Integration} The stored row.
 */
function stored(harness: GithubServiceHarness, row: Integration): Integration {
  return harness.repo.rows.find((candidate) => candidate.id === row.id) as Integration;
}

describe('IntegrationsGithubService', () => {
  installNoNetworkGuard();

  let harness: GithubServiceHarness;

  beforeEach(() => {
    harness = buildGithubServiceHarness();
  });

  describe('integration identity', () => {
    it.each([
      ['listRepositories', (h: GithubServiceHarness, id: number) => h.service.listRepositories(USER, id, 1)],
      ['listHandleRepositories', (h: GithubServiceHarness, id: number) => h.service.listHandleRepositories(USER, id, 'octocat', 1)],
      ['getRepository', (h: GithubServiceHarness, id: number) => h.service.getRepository(USER, id, 5)],
    ])('%s answers missing for a missing or foreign id, with no GitHub call', async (_name, call) => {
      const foreign = await harness.seed({ userId: INTRUDER });

      expect(await call(harness, foreign.id)).toEqual({ kind: 'integration_unusable', reason: 'missing' });
      expect(await call(harness, 999)).toEqual({ kind: 'integration_unusable', reason: 'missing' });
      expect(fetchCalls()).toHaveLength(0);
    });

    it('answers missing for an integration deleted mid-sync', async () => {
      const row = await harness.seed();
      const page = listingPage(1, [githubRepo()], { hasNext: true });

      replyOnce(fetchMock(), page);
      expect(await harness.service.listRepositories(USER, row.id, 1)).toMatchObject({ kind: 'ok' });

      await harness.repo.delete({ id: row.id });

      expect(await harness.service.listRepositories(USER, row.id, 2)).toEqual({ kind: 'integration_unusable', reason: 'missing' });
      expect(fetchCalls()).toHaveLength(1);
    });

    it('loads the row with WHERE id = ? AND user_id = ?', async () => {
      const findOne = jest.spyOn(harness.repo, 'findOne');

      await harness.service.getRepository(USER, 42, 5);

      expect(findOne).toHaveBeenCalledWith({ where: { id: 42, userId: USER } });
    });
  });

  describe('listUsableIntegrations', () => {
    it('returns only usable integrations, oldest first, filtered by user_id in the query', async () => {
      const at = (minutes: number): Date => new Date(START.getTime() - minutes * 60_000);
      const newer = await harness.seed({ type: 'pat', createdAt: at(1), label: 'newer' });
      const older = await harness.seed({ type: 'oauth_app', createdAt: at(5), label: 'older' });
      const app = await harness.seed({ type: 'github_app', createdAt: at(3), label: 'app' });

      await harness.seed({ status: 'invalid', createdAt: at(9) });
      await harness.seed({ expiresAt: at(0.5), createdAt: at(8) });
      await harness.seed({ status: 'undecryptable', createdAt: at(7) });
      const unknownKey = await harness.seed({ createdAt: at(6) });
      stored(harness, unknownKey).secretKeyId = 'zzzzzzzz';
      await harness.seed({ userId: INTRUDER, createdAt: at(10) });
      const find = jest.spyOn(harness.repo, 'find');

      expect(await harness.service.listUsableIntegrations(USER)).toEqual([
        { id: older.id, uuid: older.uuid, label: 'older', type: 'oauth_app' },
        { id: app.id, uuid: app.uuid, label: 'app', type: 'github_app' },
        { id: newer.id, uuid: newer.uuid, label: 'newer', type: 'pat' },
      ]);
      expect(find).toHaveBeenCalledWith({ where: { userId: USER }, order: { createdAt: 'ASC', id: 'ASC' } });

      harness.enabled.github_app = false;

      expect((await harness.service.listUsableIntegrations(USER)).map(({ id }) => id)).toEqual([older.id, newer.id]);
      expect(fetchCalls()).toHaveLength(0);
    });

    it('breaks a created_at tie by id', async () => {
      const first = await harness.seed({ createdAt: START });
      const second = await harness.seed({ createdAt: START });

      expect((await harness.service.listUsableIntegrations(USER)).map(({ id }) => id)).toEqual([first.id, second.id]);
    });
  });

  describe('listIntegrations', () => {
    it('returns every integration of the user, usable or not, oldest first, with allowlisted fields only', async () => {
      const at = (minutes: number): Date => new Date(START.getTime() - minutes * 60_000);
      const active = await harness.seed({ type: 'pat', createdAt: at(1), label: 'active' });
      const invalid = await harness.seed({ status: 'invalid', createdAt: at(9), label: 'invalid' });
      const app = await harness.seed({ type: 'github_app', createdAt: at(3), label: 'app' });

      await harness.seed({ userId: INTRUDER, createdAt: at(10) });
      harness.enabled.github_app = false;
      const find = jest.spyOn(harness.repo, 'find');

      expect(await harness.service.listIntegrations(USER)).toEqual([
        { id: invalid.id, uuid: invalid.uuid, label: 'invalid', type: 'pat' },
        { id: app.id, uuid: app.uuid, label: 'app', type: 'github_app' },
        { id: active.id, uuid: active.uuid, label: 'active', type: 'pat' },
      ]);
      expect(find).toHaveBeenCalledWith({ where: { userId: USER }, order: { createdAt: 'ASC', id: 'ASC' } });
      expect(fetchCalls()).toHaveLength(0);
    });
  });

  describe('non-usable integrations are never called', () => {
    it.each([
      ['expired', { expiresAt: new Date(START.getTime() - 1) }],
      ['invalid', { status: 'invalid' as const }],
      ['undecryptable', { status: 'undecryptable' as const }],
    ])('%s answers integration_unusable (status)', async (_name, options) => {
      const row = await harness.seed(options);

      expect(await harness.service.listRepositories(USER, row.id, 1)).toEqual({ kind: 'integration_unusable', reason: 'status' });
      expect(await harness.service.getRepository(USER, row.id, 5)).toEqual({ kind: 'integration_unusable', reason: 'status' });
      expect(fetchCalls()).toHaveLength(0);
    });

    it('a disabled type answers integration_unusable (type_disabled)', async () => {
      const row = await harness.seed({ type: 'github_app' });

      harness.enabled.github_app = false;

      expect(await harness.service.listRepositories(USER, row.id, 1)).toEqual({ kind: 'integration_unusable', reason: 'type_disabled' });
      expect(fetchCalls()).toHaveLength(0);
    });

    it('a row whose stored type is unknown answers type_disabled', async () => {
      const row = await harness.seed();

      stored(harness, row).type = 'gitlab';

      expect(await harness.service.listRepositories(USER, row.id, 1)).toEqual({ kind: 'integration_unusable', reason: 'type_disabled' });
    });

    it('an active row that fails to decrypt is set undecryptable, with no GitHub call', async () => {
      const row = await harness.seed();

      stored(harness, row).secretCiphertext = Buffer.from('garbage');

      expect(await harness.service.listRepositories(USER, row.id, 1)).toEqual({ kind: 'integration_unusable', reason: 'status' });
      expect(stored(harness, row).status).toBe('undecryptable');
      expect(fetchCalls()).toHaveLength(0);
    });
  });

  describe('requests', () => {
    it('lists pat / oauth_app repos from /user/repos with the stored token', async () => {
      const pat = await harness.seed({ type: 'pat' });
      const oauth = await harness.seed({ type: 'oauth_app' });

      replyOnce(fetchMock(), listingPage(1, []));
      replyOnce(fetchMock(), listingPage(1, []));
      await harness.service.listRepositories(USER, pat.id, 1, 'W/"e"');
      await harness.service.listRepositories(USER, oauth.id, 1);

      expect(fetchCalls().map(({ url }) => new URL(url).pathname)).toEqual(['/user/repos', '/user/repos']);
      expect(fetchCalls().map(({ headers }) => headers.Authorization)).toEqual([`Bearer ${CANARY_PAT}`, `Bearer ${CANARY_OAUTH_TOKEN}`]);
      expect(fetchCalls()[0].headers['If-None-Match']).toBe('W/"e"');
    });

    it('lists the handle with the given integration, or unauthenticated', async () => {
      const row = await harness.seed();

      replyOnce(fetchMock(), listingPage(1, []));
      replyOnce(fetchMock(), listingPage(1, []));
      await harness.service.listHandleRepositories(USER, row.id, 'Octo-Cat', 1);
      await harness.service.listHandleRepositories(USER, null, 'Octo-Cat', 1);

      expect(fetchCalls().map(({ url }) => new URL(url).pathname)).toEqual(['/users/Octo-Cat/repos', '/users/Octo-Cat/repos']);
      expect(fetchCalls()[0].headers.Authorization).toBe(`Bearer ${CANARY_PAT}`);
      expect(fetchCalls()[1].headers.Authorization).toBeUndefined();
    });

    it('answers the handle listing 404 as not_found', async () => {
      replyOnce(fetchMock(), notFound());

      expect(await harness.service.listHandleRepositories(USER, null, 'ghost', 1)).toEqual({ kind: 'not_found' });
    });
  });

  describe('status compare-and-set', () => {
    it.each([
      ['pat', 'bad_credentials'],
      ['oauth_app', 'revoked'],
    ] as const)('a %s 401 with the current credential sets it invalid + %s', async (type, reason) => {
      const row = await harness.seed({ type });

      replyOnce(fetchMock(), unauthorized());

      expect(await harness.service.listRepositories(USER, row.id, 1)).toEqual({ kind: 'invalid_credentials' });
      expect(stored(harness, row)).toMatchObject({ status: 'invalid', statusReason: reason });
    });

    it('a 401 from a call made before a Replace leaves the replaced integration active', async () => {
      const row = await harness.seed();
      const reply = deferred<Response>();

      fetchMock().mockImplementationOnce(() => reply.promise);
      const call = harness.service.listRepositories(USER, row.id, 1);

      await new Promise(setImmediate);
      harness.replace(row, 'ghp_REPLACEDtoken000000000000000000000000');
      reply.resolve((unauthorized().raw as () => Response)());

      expect(await call).toEqual({ kind: 'invalid_credentials' });
      expect(stored(harness, row)).toMatchObject({ status: 'active', statusReason: null });
    });

    it('a decrypt failure on a row replaced meanwhile leaves it active', async () => {
      const row = await harness.seed();
      const stale = { ...stored(harness, row), secretCiphertext: Buffer.from('garbage') };

      harness.replace(row);
      jest.spyOn(harness.store, 'findOwnedById').mockResolvedValueOnce(stale);

      expect(await harness.service.listRepositories(USER, row.id, 1)).toEqual({ kind: 'integration_unusable', reason: 'status' });
      expect(stored(harness, row).status).toBe('active');
    });

    it.each([
      ['404', 'uninstalled'],
      ['403', 'suspended'],
    ])('a mint %s from before a Replace leaves the integration active', async (status, _reason) => {
      const row = await harness.seed({ type: 'github_app' });
      const reply = deferred<Response>();

      fetchMock().mockImplementationOnce(() => reply.promise);
      const call = harness.service.listRepositories(USER, row.id, 1);

      await new Promise(setImmediate);
      harness.replace(row);
      reply.resolve(jsonResponse(Number(status), {}));

      expect(await call).toEqual({ kind: 'invalid_credentials' });
      expect(stored(harness, row).status).toBe('active');
    });

    it.each([
      [forbidden(), 'unavailable'],
      [serverError(), 'unavailable'],
      [timeout(), 'unavailable'],
      [rateLimited(new Date('2026-01-01T02:00:00Z')), 'rate_limited'],
      [redirect(), 'unavailable'],
    ])('a non-401 failure (%#) never changes the status', async (answer, kind) => {
      const row = await harness.seed();

      replyOnce(fetchMock(), answer);

      expect(await harness.service.listRepositories(USER, row.id, 1)).toMatchObject({ kind });
      expect(stored(harness, row)).toMatchObject({ status: 'active', statusReason: null });
    });
  });

  describe('credential canary sweep', () => {
    it('no credential, minted token, IV, private key or GitHub body leaves the service', async () => {
      const pat = await harness.seed({ type: 'pat' });
      const oauth = await harness.seed({ type: 'oauth_app' });
      const app = await harness.seed({ type: 'github_app' });
      const results: unknown[] = [];
      const cases = [listingPage(1, [githubRepo()]), unauthorized(), forbidden(), notFound(), serverError(), timeout(),
        redirect(), rateLimited(new Date('2026-01-01T02:00:00Z'))];

      for (const answer of cases) {
        for (const row of [pat, oauth]) {
          harness.replace(row, row.type === 'pat' ? CANARY_PAT : CANARY_OAUTH_TOKEN);
          replyOnce(fetchMock(), answer);
          results.push(await harness.service.listRepositories(USER, row.id, 1));
        }
        replyOnce(fetchMock(), answer);
        results.push(await harness.service.getRepository(USER, null, 5));
      }

      fetchMock().mockResolvedValueOnce(minted());
      replyOnce(fetchMock(), unauthorized());
      results.push(await harness.service.listRepositories(USER, app.id, 1));

      for (const mintStatus of [404, 403, 401]) {
        harness.tokens.evict(app.id);
        harness.replace(app);
        fetchMock().mockResolvedValueOnce(jsonResponse(mintStatus, { message: `${CANARY}BODY` }));
        results.push(await harness.service.listRepositories(USER, app.id, 1));
      }

      harness.tokens.evict(app.id);
      harness.replace(app);

      fetchMock().mockResolvedValueOnce(minted());
      replyOnce(fetchMock(), repository(githubRepo()));
      results.push(await harness.service.getRepository(USER, app.id, 5));

      const ivs = harness.repo.rows.flatMap((row) => [row.secretIv.toString('hex'), row.secretIv.toString('base64')]);
      const pemChunk = githubAppTestKey().base64Pem.slice(40, 80);
      const surfaced = [results, harness.logger.debug.mock.calls, harness.logger.info.mock.calls,
        harness.logger.warn.mock.calls, harness.logger.error.mock.calls]
        .map((value) => `${JSON.stringify(value)} ${inspect(value, { depth: 10 })}`)
        .join('\n');

      expect(fetchCalls().length).toBeGreaterThan(20);
      expect(surfaced).not.toContain(CANARY);
      expect(surfaced).not.toContain(pemChunk);
      ivs.forEach((iv) => expect(surfaced).not.toContain(iv));
      expect(harness.logger.warn).toHaveBeenCalledWith('github repo call failed', expect.objectContaining({
        integrationId: expect.any(Number),
        operation: 'list_repositories',
        result: 'invalid_credentials',
      }));
    });
  });
});
