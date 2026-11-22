import type { IssueProbeResult, IssueResult, IssueUpdateResult } from '../github-issue-results.js';
import type { RepoPageResult, RepoResult } from '../github-repo-results.js';
import { FakeIntegrationsGithubService } from './support/fake-integrations-github.service.js';
import {
  forbidden,
  GithubCase,
  githubIssue,
  GithubOperation,
  githubPullRequest,
  githubRepo,
  integrationUnusable,
  issue,
  issueGone,
  issueMoved,
  issuePage,
  issueRedirectOffHost,
  issueRenamed,
  jsonResponse,
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
import { buildGithubServiceHarness, GithubServiceHarness, START } from './support/integrations-github-harness.js';
import { installNoNetworkGuard, fetchMock, fetchCalls } from './support/no-network-guard.js';

const USER = 1;
const PAGE = 2;
const REPO = githubRepo({ private: true });
const LISTINGS: GithubOperation[] = ['listRepositories', 'listHandleRepositories'];
const ALL: GithubOperation[] = [...LISTINGS, 'getRepository'];
const ISSUE_REPO = { githubId: 2 ** 31 + 777, owner: 'octo-org', name: 'widgets' };
const NUMBER = 42;
const CHANGES = { title: 'New title', state: 'closed' as const };
const ISSUE_OPERATIONS: GithubOperation[] = ['getIssue', 'probeIssues', 'updateIssue'];
const ISSUE_READ_WRITE: GithubOperation[] = ['getIssue', 'updateIssue'];
const MINT_PATH = '/app/installations/4242/access_tokens';

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

/** What an issue operation answers. */
type IssueAnswer = IssueResult | IssueProbeResult | IssueUpdateResult;

/** The reads and the write, as the real services and the fake both offer them. */
interface IssueServices {
  reads: Pick<GithubServiceHarness['service'], 'getIssue' | 'probeIssues'>;
  writer: Pick<GithubServiceHarness['writer'], 'updateIssue'>;
}

/**
 * Calls one issue operation on the real services or the fake.
 * @param {IssueServices} services - The reads and the writer.
 * @param {GithubOperation} operation - The operation.
 * @param {number} integrationId - The integration.
 * @returns {Promise<IssueAnswer>} The typed result.
 */
function callIssue(services: IssueServices, operation: GithubOperation, integrationId: number): Promise<IssueAnswer> {
  switch (operation) {
    case 'getIssue':
      return services.reads.getIssue(USER, integrationId, ISSUE_REPO, NUMBER, 'W/"old"');
    case 'probeIssues':
      return services.reads.probeIssues(USER, integrationId, ISSUE_REPO);
    default:
      return services.writer.updateIssue(USER, integrationId, ISSUE_REPO, NUMBER, CHANGES);
  }
}

/**
 * Answers the same issue operation through the fake, scripted with the same builder.
 * @param {GithubCase} githubCase - The builder case.
 * @param {GithubOperation} operation - The operation.
 * @param {number} integrationId - The integration.
 * @returns {Promise<IssueAnswer>} The fake's typed result.
 */
function fakeIssueResult(githubCase: GithubCase, operation: GithubOperation, integrationId: number): Promise<IssueAnswer> {
  const fake = new FakeIntegrationsGithubService();

  fake.script(integrationId, operation, operation === 'probeIssues' ? 0 : NUMBER, githubCase);

  return callIssue({ reads: fake, writer: fake.asWriter() }, operation, integrationId);
}

/** The issue builder cases and the operations each applies to. */
const ISSUE_ROWS: ContractRow[] = [
  ['issue', () => issue(githubIssue({ body: null, state: 'closed' }), { etag: 'W/"i1"' }), ISSUE_READ_WRITE],
  ['issue (no etag)', () => issue(githubIssue(), { etag: null }), ISSUE_READ_WRITE],
  ['githubPullRequest', () => issue(githubPullRequest()), ISSUE_READ_WRITE],
  ['issuePage', () => issuePage([githubIssue()]), ['probeIssues']],
  ['issuePage (empty)', () => issuePage([]), ['probeIssues']],
  ['notModified', notModified, ISSUE_OPERATIONS],
  ['rateLimited', () => rateLimited(new Date('2026-01-01T02:00:00Z')), ISSUE_OPERATIONS],
  ['unauthorized', unauthorized, ISSUE_OPERATIONS],
  ['forbidden', forbidden, ISSUE_OPERATIONS],
  ['notFound', notFound, ISSUE_OPERATIONS],
  ['issueGone', issueGone, ISSUE_OPERATIONS],
  ['issueMoved', () => issueMoved(), ISSUE_OPERATIONS],
  ['redirect', redirect, ISSUE_OPERATIONS],
  ['issueRedirectOffHost', () => issueRedirectOffHost(), ISSUE_OPERATIONS],
  ['issueRenamed', () => issueRenamed(ISSUE_REPO, NUMBER, githubIssue(), { owner: 'renamed-org', name: 'gadgets' }), ISSUE_READ_WRITE],
  ['timeout', timeout, ISSUE_OPERATIONS],
  ['serverError', serverError, ISSUE_OPERATIONS],
];

describe('issue operations ↔ FakeIntegrationsGithubService (fake fidelity)', () => {
  installNoNetworkGuard();

  let harness: GithubServiceHarness;

  beforeEach(() => {
    harness = buildGithubServiceHarness();
  });

  describe.each(ISSUE_ROWS)('%s', (_name, build, operations) => {
    it.each(operations)('%s with a pat integration answers what the fake answers', async (operation) => {
      const row = await harness.seed({ type: 'pat' });
      const githubCase = build();

      replyOnce(fetchMock(), githubCase);

      const real = await callIssue({ reads: harness.service, writer: harness.writer }, operation, row.id);

      expect(real).toEqual(await fakeIssueResult(githubCase, operation, row.id));
    });
  });

  describe('with a github_app integration', () => {
    /**
     * A mint `201`.
     * @returns {Response} The response.
     */
    function minted(): Response {
      return jsonResponse(201, { token: 'ghs_issue-token', expires_at: new Date(START.getTime() + 3_600_000).toISOString() });
    }

    const APP_ROWS: ContractRow[] = ISSUE_ROWS.filter(([name]) => ['issue', 'notFound', 'forbidden', 'issueGone', 'issueMoved', 'serverError'].includes(name));

    describe.each(APP_ROWS)('%s', (_name, build, operations) => {
      it.each(operations)('%s answers what the fake answers', async (operation) => {
        const row = await harness.seed({ type: 'github_app' });
        const githubCase = build();

        fetchMock().mockResolvedValueOnce(minted());
        replyOnce(fetchMock(), githubCase);

        const real = await callIssue({ reads: harness.service, writer: harness.writer }, operation, row.id);

        expect(real).toEqual(await fakeIssueResult(githubCase, operation, row.id));
      });
    });

    it.each([
      ['getIssue', '{"permissions":{"issues":"read","metadata":"read"}}'],
      ['probeIssues', '{"permissions":{"issues":"read","metadata":"read"}}'],
      ['updateIssue', '{"permissions":{"issues":"write"}}'],
    ])('%s mints its token with exactly its own permissions', async (operation, body) => {
      const row = await harness.seed({ type: 'github_app' });

      fetchMock().mockResolvedValueOnce(minted());
      replyOnce(fetchMock(), operation === 'probeIssues' ? issuePage([]) : issue(githubIssue()));

      await callIssue({ reads: harness.service, writer: harness.writer }, operation as GithubOperation, row.id);

      const [mint] = fetchCalls();

      expect(new URL(mint.url).pathname).toBe(MINT_PATH);
      expect(mint.init.body).toBe(body);
    });

    it('answers unavailable (unexpected) for a freshly minted token that GitHub refuses with a 401', async () => {
      const row = await harness.seed({ type: 'github_app' });

      fetchMock().mockResolvedValueOnce(minted());
      replyOnce(fetchMock(), unauthorized());

      expect(await harness.service.getIssue(USER, row.id, ISSUE_REPO, NUMBER)).toEqual({ kind: 'unavailable', reason: 'unexpected' });
    });
  });

  describe('requests', () => {
    it('sends GET /repos/{owner}/{name}/issues/{number} with If-None-Match, URL-encoding the names', async () => {
      const row = await harness.seed({ type: 'pat' });

      replyOnce(fetchMock(), issue(githubIssue()));
      await harness.service.getIssue(USER, row.id, { ...ISSUE_REPO, owner: 'o w', name: 'a/b' }, NUMBER, 'W/"old"');

      const [call, ...rest] = fetchCalls();

      expect(rest).toEqual([]);
      expect(call.url).toBe(`https://api.github.com/repos/o%20w/a%2Fb/issues/${NUMBER}`);
      expect(call.init.method).toBe('GET');
      expect(call.init.redirect).toBe('manual');
      expect(call.headers['If-None-Match']).toBe('W/"old"');
    });

    it('sends GET /repos/{owner}/{name}/issues?per_page=1 for the probe', async () => {
      const row = await harness.seed({ type: 'pat' });

      replyOnce(fetchMock(), issuePage([]));
      await harness.service.probeIssues(USER, row.id, ISSUE_REPO);

      expect(fetchCalls().map(({ url, init }) => [init.method, url]))
        .toEqual([['GET', 'https://api.github.com/repos/octo-org/widgets/issues?per_page=1']]);
    });

    it('sends PATCH with exactly the given diff', async () => {
      const row = await harness.seed({ type: 'pat' });

      replyOnce(fetchMock(), issue(githubIssue()));
      await harness.writer.updateIssue(USER, row.id, ISSUE_REPO, NUMBER, CHANGES);

      const [call, ...rest] = fetchCalls();

      expect(rest).toEqual([]);
      expect(call.init.method).toBe('PATCH');
      expect(call.url).toBe(`https://api.github.com/repos/octo-org/widgets/issues/${NUMBER}`);
      expect(call.init.body).toBe('{"title":"New title","state":"closed"}');
    });

    it.each(['issueMoved', 'issueRedirectOffHost'])('%s makes a single call, to the original URL', async (name) => {
      const row = await harness.seed({ type: 'pat' });

      replyOnce(fetchMock(), name === 'issueMoved' ? issueMoved() : issueRedirectOffHost());
      await harness.service.getIssue(USER, row.id, ISSUE_REPO, NUMBER);

      expect(fetchCalls().map(({ url }) => url)).toEqual([`https://api.github.com/repos/octo-org/widgets/issues/${NUMBER}`]);
    });

    it.each(ISSUE_READ_WRITE)('issueRenamed: %s makes exactly two calls, the second to the rebuilt rename URL, with the same body', async (operation) => {
      const row = await harness.seed({ type: 'pat' });

      replyOnce(fetchMock(), issueRenamed(ISSUE_REPO, NUMBER, githubIssue(), { owner: 'renamed-org', name: 'gadgets' }));
      await callIssue({ reads: harness.service, writer: harness.writer }, operation, row.id);

      const calls = fetchCalls();

      expect(calls).toHaveLength(2);
      expect(calls[1].url).toBe(`https://api.github.com/repositories/${ISSUE_REPO.githubId}/issues/${NUMBER}`);
      expect(calls[1].init.method).toBe(calls[0].init.method);
      expect(calls[1].init.body).toBe(calls[0].init.body);
    });

    it('integrationUnusable makes no GitHub call, for every issue operation', async () => {
      for (const operation of ISSUE_OPERATIONS) {
        const answer = await callIssue({ reads: harness.service, writer: harness.writer }, operation, 404);

        expect(answer).toEqual(await fakeIssueResult(integrationUnusable('missing'), operation, 404));
      }

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
