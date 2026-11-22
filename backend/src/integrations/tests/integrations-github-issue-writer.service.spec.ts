import type { Integration } from '../entities/integration.entity.js';
import {
  forbidden,
  githubIssue,
  issue,
  issueGone,
  issueRenamed,
  jsonResponse,
  notFound,
  replyOnce,
  unauthorized,
} from './support/github-builders.js';
import {
  buildGithubServiceHarness,
  CANARY_INSTALLATION_TOKEN,
  CANARY_PAT,
  GithubServiceHarness,
  START,
} from './support/integrations-github-harness.js';
import { fetchCalls, fetchMock, installNoNetworkGuard } from './support/no-network-guard.js';

const USER = 1;
const REPO = { githubId: 2 ** 31 + 4242, owner: 'octo-org', name: 'widgets' };
const NUMBER = 7;
const CANARY_TITLE = 'CANARYcanaryTITLE issue title';
const CANARY_BODY = 'CANARYcanaryBODY issue body';

/**
 * The mint's `201`.
 * @param {string} [token] - The minted token.
 * @returns {Response} The response.
 */
function minted(token: string = CANARY_INSTALLATION_TOKEN): Response {
  return jsonResponse(201, { token, expires_at: new Date(START.getTime() + 3_600_000).toISOString() });
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

describe('IntegrationsGithubIssueWriter', () => {
  installNoNetworkGuard();

  let harness: GithubServiceHarness;

  beforeEach(() => {
    harness = buildGithubServiceHarness();
  });

  describe('validation, before any load or call', () => {
    it.each([
      ['state_reason', { state: 'closed', state_reason: 'completed' }],
      ['an unknown field', { title: 'T', labels: [] }],
      ['an empty diff', {}],
      ['only undefined fields', { title: undefined, body: undefined }],
      ['a bad state', { state: 'all' }],
      ['a non-string title', { title: 7 }],
      ['a non-string body', { body: 7 }],
      ['a null title', { title: null }],
    ])('throws a TypeError for %s, with no load and no fetch', async (_name, changes) => {
      const load = jest.spyOn(harness.store, 'findOwnedById');
      const call = (): Promise<unknown> => harness.writer.updateIssue(USER, 1, REPO, NUMBER, changes as never);

      expect(call).toThrow(TypeError);
      expect(load).not.toHaveBeenCalled();
      expect(fetchCalls()).toHaveLength(0);
    });

    it('never echoes a value in the error message', () => {
      expect(() => harness.writer.updateIssue(USER, 1, REPO, NUMBER, { title: CANARY_TITLE, state_reason: CANARY_BODY } as never))
        .toThrow(/^changes may only hold title, body and state$/);
    });

    it('accepts a title, a body (or null) and a state', async () => {
      const row = await harness.seed();

      replyOnce(fetchMock(), issue(githubIssue()));
      replyOnce(fetchMock(), issue(githubIssue()));

      await harness.writer.updateIssue(USER, row.id, REPO, NUMBER, { title: 'T', body: 'B', state: 'open' });
      await harness.writer.updateIssue(USER, row.id, REPO, NUMBER, { body: null });

      expect(fetchCalls().map(({ init }) => init.body)).toEqual(['{"title":"T","body":"B","state":"open"}', '{"body":null}']);
    });
  });

  describe('the call', () => {
    it('answers integration_unusable with no fetch for a foreign or missing integration', async () => {
      const row = await harness.seed({ userId: 2 });

      expect(await harness.writer.updateIssue(USER, row.id, REPO, NUMBER, { title: 'T' })).toEqual({ kind: 'integration_unusable', reason: 'missing' });
      expect(await harness.writer.updateIssue(USER, 404, REPO, NUMBER, { title: 'T' })).toEqual({ kind: 'integration_unusable', reason: 'missing' });
      expect(fetchCalls()).toHaveLength(0);
    });

    it('PATCHes with the stored token and answers the updated issue', async () => {
      const row = await harness.seed();
      const value = githubIssue({ state: 'closed' });

      replyOnce(fetchMock(), issue(value));

      expect(await harness.writer.updateIssue(USER, row.id, REPO, NUMBER, { state: 'closed' })).toEqual({ kind: 'ok', issue: value });
      expect(fetchCalls()[0].headers.Authorization).toBe(`Bearer ${CANARY_PAT}`);
      expect(fetchCalls()[0].init.method).toBe('PATCH');
    });

    it('a github_app call mints with exactly { issues: write }', async () => {
      const row = await harness.seed({ type: 'github_app' });

      fetchMock().mockResolvedValueOnce(minted());
      replyOnce(fetchMock(), issue(githubIssue()));

      await harness.writer.updateIssue(USER, row.id, REPO, NUMBER, { title: 'T' });

      const [mint, patch] = fetchCalls();

      expect(mint.init.body).toBe('{"permissions":{"issues":"write"}}');
      expect(patch.headers.Authorization).toBe(`Bearer ${CANARY_INSTALLATION_TOKEN}`);
    });

    it('never reuses a read token for the write, nor the write token for a read', async () => {
      const row = await harness.seed({ type: 'github_app' });

      fetchMock().mockResolvedValueOnce(minted('ghs_READtoken'));
      replyOnce(fetchMock(), issue(githubIssue()));
      fetchMock().mockResolvedValueOnce(minted('ghs_WRITEtoken'));
      replyOnce(fetchMock(), issue(githubIssue()));
      replyOnce(fetchMock(), issue(githubIssue()));

      await harness.service.getIssue(USER, row.id, REPO, NUMBER);
      await harness.writer.updateIssue(USER, row.id, REPO, NUMBER, { title: 'T' });
      await harness.service.getIssue(USER, row.id, REPO, NUMBER);

      const calls = fetchCalls();

      expect(calls.map(({ init }) => init.body)).toEqual([
        '{"permissions":{"issues":"read","metadata":"read"}}',
        undefined,
        '{"permissions":{"issues":"write"}}',
        '{"title":"T"}',
        undefined,
      ]);
      expect([calls[1], calls[3], calls[4]].map(({ headers }) => headers.Authorization))
        .toEqual(['Bearer ghs_READtoken', 'Bearer ghs_WRITEtoken', 'Bearer ghs_READtoken']);
    });

    it('a pat 401 sets it invalid', async () => {
      const row = await harness.seed();

      replyOnce(fetchMock(), unauthorized());

      expect(await harness.writer.updateIssue(USER, row.id, REPO, NUMBER, { title: 'T' })).toEqual({ kind: 'invalid_credentials' });
      expect(stored(harness, row)).toMatchObject({ status: 'invalid', statusReason: 'bad_credentials' });
    });

    it('a 403 is forbidden and does not invalidate', async () => {
      const row = await harness.seed();

      replyOnce(fetchMock(), forbidden());

      expect(await harness.writer.updateIssue(USER, row.id, REPO, NUMBER, { title: 'T' })).toEqual({ kind: 'forbidden' });
      expect(stored(harness, row)).toMatchObject({ status: 'active', statusReason: null });
    });

    it('answers not_found, gone and a followed rename', async () => {
      const row = await harness.seed();
      const value = githubIssue();

      replyOnce(fetchMock(), notFound());
      replyOnce(fetchMock(), issueGone());
      replyOnce(fetchMock(), issueRenamed(REPO, NUMBER, value, { owner: 'new-org', name: 'gadgets' }));

      expect(await harness.writer.updateIssue(USER, row.id, REPO, NUMBER, { title: 'T' })).toEqual({ kind: 'not_found' });
      expect(await harness.writer.updateIssue(USER, row.id, REPO, NUMBER, { title: 'T' })).toEqual({ kind: 'gone' });
      expect(await harness.writer.updateIssue(USER, row.id, REPO, NUMBER, { title: 'T' }))
        .toEqual({ kind: 'ok', issue: value, renamedTo: { owner: 'new-org', name: 'gadgets' } });
    });
  });

  describe('logs', () => {
    it('carry only safe fields: no title, body, URL or token', async () => {
      const row = await harness.seed();

      replyOnce(fetchMock(), forbidden());

      await harness.writer.updateIssue(USER, row.id, REPO, NUMBER, { title: CANARY_TITLE, body: CANARY_BODY });

      const logged = Object.values(harness.logger).flatMap((mock) => mock.mock.calls);

      expect(harness.logger.warn.mock.calls).toEqual([[
        'github repo call failed',
        { integrationId: row.id, operation: 'update_issue', status: 403, result: 'forbidden' },
      ]]);
      expect(JSON.stringify(logged)).not.toMatch(/CANARYcanary|api\.github\.com|octo-org|ghp_/);
    });
  });
});
