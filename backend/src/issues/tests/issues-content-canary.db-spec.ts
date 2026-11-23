import type request from 'supertest';
import { expectNoCanary, serializeJobs, serializeLogs } from './support/canary-assertions.js';
import { buildCanaryWorld, CANARY_NUMBER, type CanaryContent, type CanaryWorld } from './support/canary-world.js';
import { buildIssuesCanaryHarness, postAs, type IssuesCanaryHarness } from './support/issues-canary-harness.js';
import { ISSUE_ID, PROJECT_ID, ROUTE_ROWS, type RouteRow } from './support/registered-routes.js';
import { linkIssue, runOutcome, SYNC_OUTCOMES } from './support/sync-outcomes.js';
import {
  forbidden, githubIssue, issue as issueCase, notFound, rateLimited, serverError, timeout, unauthorized, type GithubCase,
} from '../../integrations/tests/support/github-builders.js';

// The content canary of `docs/agents/modules/issues/testing.md#security-verification` (docs/agents/modules/issues/security.md, "What may
// be logged"): a project name and description, an issue title and body, GitHub's title and body and a
// repository owner and name each carry a distinct canary; every route, refusals included, and the reconcile
// job run, and no log line holds any of them. A 4xx refusal produces only the access line.
const CONTENT = {
  projectName: 'CANARYcontentPROJECTNAME',
  projectDescription: 'CANARYcontentPROJECTDESCRIPTION',
  issueTitle: 'CANARYcontentISSUETITLE',
  issueBody: 'CANARYcontentISSUEBODY',
  githubTitle: 'CANARYcontentGITHUBTITLE',
  githubBody: 'CANARYcontentGITHUBBODY',
  owner: 'CANARYcontentOWNER',
  name: 'CANARYcontentREPOSITORYNAME',
};
const FRAGMENT = 'CANARYcontent';
const CANARIES = [FRAGMENT, ...Object.values(CONTENT)];
const WORLD_CONTENT: CanaryContent = {
  projectName: CONTENT.projectName,
  projectDescription: CONTENT.projectDescription,
  issueTitle: CONTENT.issueTitle,
  issueBody: CONTENT.issueBody,
  repositoryOwner: CONTENT.owner,
  repositoryName: CONTENT.name,
};
const MISSING = '00000000-0000-4000-8000-000000000000';
const LIMIT = 5;
const LINKED_ROUTES = ['unlink.json', 'refresh.json', 'retry-sync.json'];

/** Bodies that carry content, per route (the others take none). */
const CONTENT_BODIES: Record<string, Record<string, unknown>> = {
  '/projects/mine.json': { search: CONTENT.projectName },
  '/projects/create.json': { name: `${CONTENT.projectName} new`, description: CONTENT.projectDescription },
  '/projects/from-repository.json': { name: `${CONTENT.projectName} from`, repository: { githubId: 700 } },
  [`/projects/${PROJECT_ID}/edit.json`]: { name: `${CONTENT.projectName} renamed`, description: CONTENT.projectDescription },
  [`/projects/${PROJECT_ID}/repository.json`]: { repository: { githubId: 700 } },
  [`/projects/${PROJECT_ID}/issues.json`]: { search: CONTENT.issueTitle },
  [`/projects/${PROJECT_ID}/issues/create.json`]: { title: CONTENT.issueTitle, body: CONTENT.issueBody },
  [`/projects/${PROJECT_ID}/issues/${ISSUE_ID}/edit.json`]: { title: `${CONTENT.issueTitle} edited`, body: CONTENT.issueBody },
};

/** The GitHub failures a link creation can meet. */
const GITHUB_FAILURES: Array<[string, () => GithubCase]> = [
  ['401', unauthorized],
  ['403', forbidden],
  ['404', notFound],
  ['rate limit', () => rateLimited(new Date(Date.UTC(2099, 0, 1)))],
  ['5xx', serverError],
  ['timeout', timeout],
];

describe('Issues content canary sweep (real MySQL)', () => {
  let harness: IssuesCanaryHarness;
  const jobs: string[] = [];
  const refusals: Array<{ route: string; status: number; lines: unknown[][] }> = [];
  let requests = 0;

  beforeAll(async () => {
    harness = await buildIssuesCanaryHarness({ KERGHAN_ISSUES_LINK_MAX_PER_WINDOW: `${LIMIT}`, KERGHAN_ISSUES_EDIT_MAX_PER_WINDOW: `${LIMIT}` });
  });

  afterAll(() => harness.close());

  afterEach(() => collectJobs());

  function collectJobs(): void {
    jobs.push(serializeJobs(harness.workers));
  }

  const spies = () => Object.entries(harness.logs);
  const counts = (): number[] => spies().map(([, spy]) => spy.mock.calls.length);

  /** The log calls written since `before`, as `[level, ...args]`. */
  function linesSince(before: number[]): unknown[][] {
    return spies().flatMap(([level, spy], index) => spy.mock.calls.slice(before[index]).map((args: unknown[]) => [level, ...args]));
  }

  async function world(types: Array<'pat' | 'oauth_app' | 'github_app'> = ['pat']): Promise<CanaryWorld> {
    collectJobs();

    return buildCanaryWorld(harness, types, WORLD_CONTENT);
  }

  /** Runs a request, remembering what it logged: no content, and for a 4xx only the access line. */
  async function record(pending: request.Test, route: string): Promise<request.Response> {
    const before = counts();
    const response = await pending;
    const lines = linesSince(before);

    requests += 1;
    expectNoCanary([JSON.stringify(lines)], CANARIES);
    if (response.status >= 400 && response.status < 500) refusals.push({ route, status: response.status, lines });

    return response;
  }

  const resolve = (row: RouteRow, w: CanaryWorld): string => row.path.replace(PROJECT_ID, w.project.uuid).replace(ISSUE_ID, w.issue.uuid);
  const bodyOf = (row: RouteRow): Record<string, unknown> => CONTENT_BODIES[row.path] ?? row.body;
  const isLinked = (row: RouteRow): boolean => LINKED_ROUTES.some((suffix) => row.path.endsWith(suffix));
  const send = (row: RouteRow, w: CanaryWorld, cookie = w.cookie, body = bodyOf(row)) => record(postAs(harness, resolve(row, w), cookie, body), row.path);
  const github = (title = CONTENT.githubTitle): GithubCase => issueCase(
    githubIssue({ number: CANARY_NUMBER, title, body: CONTENT.githubBody, updatedAt: new Date('2026-06-01T11:00:00Z') }), { etag: 'W/"g1"' },
  );

  describe.each(ROUTE_ROWS.map((row) => [`POST ${row.path}`, row] as const))('%s', (_name, row) => {
    it('runs as the owner with content, GitHub answering with its own content', async () => {
      const w = await world();

      if (isLinked(row)) await linkIssue(harness, w);
      harness.github.reads(github()).writes(github(`${CONTENT.githubTitle} pushed`));

      await send(row, w);
    });

    it('refuses with 404 (a missing project, the intruder) and 400 (a bad body, a bad id) with no line beyond the access line', async () => {
      const w = await world();

      if (row.path.includes(PROJECT_ID)) {
        expect((await record(postAs(harness, resolve(row, w).replace(w.project.uuid, MISSING), w.cookie, bodyOf(row)), row.path)).status).toBe(404);
        expect((await send(row, w, harness.intruderCookie())).status).toBe(404);
      }

      if (row.invalidBody) expect((await send(row, w, w.cookie, { ...bodyOf(row), ...row.invalidBody })).status).toBe(400);
      if (row.path.includes(ISSUE_ID)) expect((await record(postAs(harness, resolve(row, w).replace(w.issue.uuid, 'not-a-uuid'), w.cookie, bodyOf(row)), row.path)).status).toBe(400);
    });
  });

  describe('409 refusals carrying the duplicated content', () => {
    const row = (suffix: string): RouteRow => ROUTE_ROWS.find((candidate) => candidate.path.endsWith(suffix)) as RouteRow;

    it('PROJECT_NAME_TAKEN: a second project with the same name, a rename onto it', async () => {
      const w = await world();

      expect((await record(postAs(harness, '/projects/create.json', w.cookie, { name: CONTENT.projectName }), 'create')).status).toBe(409);

      const other = await record(postAs(harness, '/projects/create.json', w.cookie, { name: `${CONTENT.projectName} other` }), 'create');

      expect(other.status).toBe(201);
      expect((await record(postAs(harness, `/projects/${other.body.id}/edit.json`, w.cookie, { name: CONTENT.projectName }), 'edit')).status).toBe(409);
    });

    it('PROJECT_REPOSITORY_TAKEN: a second project on the repository, and the from-repository shortcut\'s 200', async () => {
      const w = await world();

      expect((await record(postAs(harness, '/projects/create.json', w.cookie, { name: `${CONTENT.projectName} two`, repository: { githubId: 700 } }), 'create')).status).toBe(409);
      expect((await send(row('from-repository.json'), w)).status).toBe(200);
    });

    it('GITHUB_ISSUE_ALREADY_LINKED and ISSUE_ALREADY_LINKED: the same GitHub issue, the same issue', async () => {
      const w = await world();

      harness.github.reads(github());
      expect((await send(row('import.json'), w)).status).toBe(201);
      expect((await send(row('import.json'), w)).status).toBe(409);
      expect((await send(row('attach.json'), w)).status).toBe(409);
    });
  });

  describe('GitHub failures on a link creation', () => {
    it.each(['import.json', 'attach.json'].flatMap((suffix) => GITHUB_FAILURES.map(([label, answer]) => [suffix, label, answer] as const)))(
      '%s with a GitHub %s',
      async (suffix, _label, answer) => {
        const w = await world();

        harness.github.reads(answer());
        await send(ROUTE_ROWS.find((candidate) => candidate.path.endsWith(suffix)) as RouteRow, w);
      },
    );
  });

  describe('429 refusals', () => {
    it('ISSUE_LINK_RATE_LIMITED past the link window and ISSUE_EDIT_RATE_LIMITED past the edit window', async () => {
      const w = await world();
      const importRow = ROUTE_ROWS.find((candidate) => candidate.path.endsWith('import.json')) as RouteRow;
      const editRow = ROUTE_ROWS.find((candidate) => candidate.path.includes('/issues/') && candidate.path.endsWith('/edit.json')) as RouteRow;
      const statuses: number[] = [];

      harness.github.reads(github());
      for (let call = 0; call <= LIMIT; call += 1) statuses.push((await send(importRow, w, w.cookie, { number: CANARY_NUMBER + call })).status);
      for (let call = 0; call <= LIMIT; call += 1) statuses.push((await send(editRow, w, w.cookie, { title: `${CONTENT.issueTitle} ${call}` })).status);

      expect(statuses.filter((status) => status === 429)).toHaveLength(2);
    });
  });

  describe('the reconcile job (E17, E19 to E22, E24, exhausted retries)', () => {
    it.each(SYNC_OUTCOMES.map((outcome) => [outcome.title, outcome] as const))('%s', async (_title, outcome) => {
      const w = await world(outcome.noIntegration ? [] : ['oauth_app']);

      await runOutcome(harness, w, outcome, { title: CONTENT.githubTitle, body: CONTENT.githubBody, local: `${CONTENT.issueTitle} local` });
      await record(postAs(harness, `/projects/${w.project.uuid}/issues/${w.issue.uuid}/show.json`, w.cookie), 'show');
    });
  });

  describe('the whole sweep (docs/agents/modules/issues/testing.md#security-verification)', () => {
    it('ran many requests, with refusals among them (the sweep is not vacuous)', () => {
      expect(requests).toBeGreaterThan(100);
      [400, 404, 409, 429].forEach((status) => expect(refusals.map((refusal) => refusal.status)).toContain(status));
      expect(refusals.length).toBeGreaterThan(40);
    });

    it('logs no content in any line, and the access line carries only method, path, status and request id', () => {
      expect(harness.logs.info).toHaveBeenCalledWith('request', { method: 'POST', path: expect.any(String), statusCode: expect.any(Number), requestId: expect.any(String) });
      expectNoCanary([serializeLogs(harness.logs)], CANARIES);
    });

    it('records no content in any job param or job log', () => {
      collectJobs();
      expectNoCanary(jobs, CANARIES);
    });

    it('produces only the access line for every 4xx refusal, bar the Integrations module\'s own allowlisted line of a failed GitHub call', () => {
      const isAccessLine = (line: unknown[]): boolean => line[0] === 'info' && line[1] === 'request';
      // `docs/agents/modules/issues/security.md#what-may-be-logged`: "Integrations (existing)": the integration id, the operation, the status and the result kind.
      const isIntegrationsLine = (line: unknown[]): boolean => line[0] === 'warn' && line[1] === 'github repo call failed'
        && Object.keys(line[2] as object).sort().join() === 'integrationId,operation,requestId,result,status';
      const extra = refusals.filter((refusal) => !refusal.lines.every((line) => isAccessLine(line) || isIntegrationsLine(line)) || !refusal.lines.some(isAccessLine));

      expect(extra.map((refusal) => `${refusal.route} ${refusal.status}: ${JSON.stringify(refusal.lines).slice(0, 300)}`)).toEqual([]);
    });
  });
});
