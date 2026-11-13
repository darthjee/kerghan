import type { RepoPageResult, RepoResult } from '../github-repo-results.js';
import { FakeIntegrationsGithubService } from './support/fake-integrations-github.service.js';
import {
  forbidden,
  GithubCase,
  GithubOperation,
  githubRepo,
  integrationUnusable,
  listingPage,
  notFound,
  notModified,
  rateLimited,
  redirect,
  replyOnce,
  repository,
  serverError,
  timeout,
  unauthorized,
} from './support/github-builders.js';
import { buildGithubServiceHarness, GithubServiceHarness } from './support/integrations-github-harness.js';
import { installNoNetworkGuard, fetchMock, fetchCalls } from './support/no-network-guard.js';

const USER = 1;
const PAGE = 2;
const REPO = githubRepo({ private: true });
const LISTINGS: GithubOperation[] = ['listRepositories', 'listHandleRepositories'];
const ALL: GithubOperation[] = [...LISTINGS, 'getRepository'];

/** One contract row: a builder case, the operations it applies to, and whether it is unauthenticated. */
type ContractRow = [string, () => GithubCase, GithubOperation[]];

const AUTHENTICATED_ROWS: ContractRow[] = [
  ['listingPage', () => listingPage(PAGE, [REPO, githubRepo()], { hasNext: true, etag: 'W/"p2"' }), LISTINGS],
  ['listingPage (last page, no etag)', () => listingPage(PAGE, [], { etag: null }), LISTINGS],
  ['repository', () => repository(REPO), ['getRepository']],
  ['notModified', notModified, ALL],
  ['rateLimited', () => rateLimited(new Date('2026-01-01T02:00:00Z')), ALL],
  ['unauthorized', unauthorized, ALL],
  ['forbidden', forbidden, ALL],
  ['notFound', notFound, ALL],
  ['timeout', timeout, ALL],
  ['serverError', serverError, ALL],
  ['redirect', redirect, ALL],
];

/**
 * Calls one operation on the real service or the fake.
 * @param {Pick<GithubServiceHarness['service'], 'listRepositories' | 'listHandleRepositories' | 'getRepository'>} service - The service.
 * @param {GithubOperation} operation - The operation.
 * @param {number | null} integrationId - The integration, or `null`.
 * @returns {Promise<RepoPageResult | RepoResult>} The typed result.
 */
function call(
  service: Pick<GithubServiceHarness['service'], 'listRepositories' | 'listHandleRepositories' | 'getRepository'>,
  operation: GithubOperation,
  integrationId: number | null,
): Promise<RepoPageResult | RepoResult> {
  switch (operation) {
    case 'listRepositories':
      return service.listRepositories(USER, integrationId as number, PAGE, 'W/"old"');
    case 'listHandleRepositories':
      return service.listHandleRepositories(USER, integrationId, 'octocat', PAGE, 'W/"old"');
    default:
      return service.getRepository(USER, integrationId, REPO.githubId);
  }
}

/**
 * Answers the same operation through the fake, scripted with the same builder.
 * @param {GithubCase} githubCase - The builder case.
 * @param {GithubOperation} operation - The operation.
 * @param {number | null} integrationId - The integration, or `null`.
 * @returns {Promise<RepoPageResult | RepoResult>} The fake's typed result.
 */
function fakeResult(githubCase: GithubCase, operation: GithubOperation, integrationId: number | null): Promise<RepoPageResult | RepoResult> {
  const fake = new FakeIntegrationsGithubService();

  fake.script(integrationId, operation, operation === 'getRepository' ? REPO.githubId : PAGE, githubCase);

  return call(fake, operation, integrationId);
}

describe('IntegrationsGithubService ↔ FakeIntegrationsGithubService (fake fidelity)', () => {
  installNoNetworkGuard();

  let harness: GithubServiceHarness;

  beforeEach(() => {
    harness = buildGithubServiceHarness();
  });

  describe.each(AUTHENTICATED_ROWS)('%s', (_name, build, operations) => {
    it.each(operations)('%s with an integration answers what the fake answers', async (operation) => {
      const row = await harness.seed({ type: 'pat' });
      const githubCase = build();

      replyOnce(fetchMock(), githubCase);

      expect(await call(harness.service, operation, row.id)).toEqual(await fakeResult(githubCase, operation, row.id));
    });
  });

  describe.each(AUTHENTICATED_ROWS.filter(([name]) => name !== 'unauthorized'))('%s, unauthenticated', (_name, build, operations) => {
    it.each(operations.filter((operation) => operation !== 'listRepositories'))('%s answers what the fake answers', async (operation) => {
      const githubCase = build();

      replyOnce(fetchMock(), githubCase);

      expect(await call(harness.service, operation, null)).toEqual(await fakeResult(githubCase, operation, null));
    });
  });

  describe('integrationUnusable', () => {
    it.each(ALL)('missing: %s answers what the fake answers, with no GitHub call', async (operation) => {
      const githubCase = integrationUnusable('missing');

      expect(await call(harness.service, operation, 404)).toEqual(await fakeResult(githubCase, operation, 404));
      expect(fetchCalls()).toHaveLength(0);
    });

    it.each(ALL)('status: %s answers what the fake answers, with no GitHub call', async (operation) => {
      const row = await harness.seed({ status: 'invalid' });
      const githubCase = integrationUnusable('status');

      expect(await call(harness.service, operation, row.id)).toEqual(await fakeResult(githubCase, operation, row.id));
      expect(fetchCalls()).toHaveLength(0);
    });

    it.each(ALL)('type_disabled: %s answers what the fake answers, with no GitHub call', async (operation) => {
      const row = await harness.seed({ type: 'github_app' });
      const githubCase = integrationUnusable('type_disabled');

      harness.enabled.github_app = false;

      expect(await call(harness.service, operation, row.id)).toEqual(await fakeResult(githubCase, operation, row.id));
      expect(fetchCalls()).toHaveLength(0);
    });
  });
});

describe('FakeIntegrationsGithubService', () => {
  it('logs every call, uses answers in order with the last one sticking, and throws when unscripted', async () => {
    const fake = new FakeIntegrationsGithubService();

    fake.script(1, 'listRepositories', '*', notFound(), serverError());

    expect(await fake.listRepositories(USER, 1, 1)).toEqual({ kind: 'unavailable', reason: 'unexpected' });
    expect(await fake.listRepositories(USER, 1, 2)).toEqual({ kind: 'unavailable', reason: 'server_error' });
    expect(await fake.listRepositories(USER, 1, 3)).toEqual({ kind: 'unavailable', reason: 'server_error' });
    await expect(fake.getRepository(USER, 1, 5)).rejects.toThrow('unscripted');
    expect(await fake.listUsableIntegrations(USER)).toEqual([]);
    expect(fake.calls.map(({ operation }) => operation))
      .toEqual(['listRepositories', 'listRepositories', 'listRepositories', 'getRepository', 'listUsableIntegrations']);
    expect(fake.githubCalls()).toHaveLength(4);
  });

  it('holds an answer on a deferred promise until the spec releases it', async () => {
    const fake = new FakeIntegrationsGithubService();
    const held = fake.hold(null, 'listHandleRepositories', 1);
    let settled = false;
    const pending = fake.listHandleRepositories(USER, null, 'octocat', 1).then((result) => {
      settled = true;
      return result;
    });

    await new Promise(setImmediate);
    expect(settled).toBe(false);

    held.resolve({ kind: 'not_found' });

    expect(await pending).toEqual({ kind: 'not_found' });
  });

  it('answers the usable list it was given', async () => {
    const fake = new FakeIntegrationsGithubService();
    const refs = [{ id: 1, uuid: 'u', label: 'l', type: 'pat' as const }];

    fake.setUsable(USER, refs);

    expect(await fake.listUsableIntegrations(USER)).toEqual(refs);
    expect(await fake.listIntegrations(USER)).toEqual(refs);
  });

  it('answers the full list it was given, logged as a non-GitHub call', async () => {
    const fake = new FakeIntegrationsGithubService();
    const usable = [{ id: 1, uuid: 'u', label: 'l', type: 'pat' as const }];
    const all = [...usable, { id: 2, uuid: 'v', label: 'm', type: 'oauth_app' as const }];

    fake.setUsable(USER, usable).setIntegrations(USER, all);

    expect(await fake.listIntegrations(USER)).toEqual(all);
    expect(await fake.listUsableIntegrations(USER)).toEqual(usable);
    expect(fake.calls.map(({ operation }) => operation)).toEqual(['listIntegrations', 'listUsableIntegrations']);
    expect(fake.githubCalls()).toEqual([]);
  });

  it('matches the real service: listIntegrations keeps the same allowlisted keys as listUsableIntegrations', async () => {
    const harness = buildGithubServiceHarness();
    const row = await harness.seed({ type: 'pat', label: 'kept', status: 'invalid' });
    const refs = await harness.service.listIntegrations(USER);

    expect(refs).toEqual([{ id: row.id, uuid: row.uuid, label: 'kept', type: 'pat' }]);
    expect(Object.keys(refs[0]).sort()).toEqual(['id', 'label', 'type', 'uuid']);
  });
});
