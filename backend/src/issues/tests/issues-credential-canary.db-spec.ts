import type request from 'supertest';
import type { IntegrationType } from '../../integrations/integration-enums.js';
import { ISSUES_RECONCILE_JOB } from '../jobs/issues-reconcile.job.js';
import { FORBIDDEN_BODY_KEYS, keysOf } from './support/build-issues-test-app.js';
import { expectNoCanary, serializeJobs, serializeLogs, serializeResponse } from './support/canary-assertions.js';
import { buildCanaryWorld, CANARY_NUMBER, type CanaryWorld } from './support/canary-world.js';
import { buildIssuesCanaryHarness, postAs, type IssuesCanaryHarness } from './support/issues-canary-harness.js';
import { ISSUE_ID, PROJECT_ID, ROUTE_ROWS, registeredRoutes, type RouteRow } from './support/registered-routes.js';
import { linkIssue as linkIssueOf, remoteIssue, runOutcome, SYNC_OUTCOMES } from './support/sync-outcomes.js';
import {
  forbidden, githubPullRequest, issue as issueCase, issueMoved, notFound, notModified, rateLimited, serverError,
  timeout, unauthorized, type GithubCase,
} from '../../integrations/tests/support/github-builders.js';
import { canaryAppKey, CANARY, CANARY_ERROR_BODY } from '../../integrations/tests/support/integrations-github-harness.js';

// The credential canary sweep of `docs/agents/specs/issues/testing.md#security-verification`: the real
// Integrations services carry a PAT, an OAuth token, a GitHub App installation (private key and minted
// installation token) and GitHub answers embed a canary error body; every route, refusals included,
// and every sync outcome runs, and no response body or header (`error.meta` included), no captured log
// line and no recorded job param may hold any of them.
const TYPES: IntegrationType[] = ['pat', 'oauth_app', 'github_app'];
const MISSING = '00000000-0000-4000-8000-000000000000';
const LINKED_ROUTES = ['unlink.json', 'refresh.json', 'retry-sync.json'];
const LIMIT = 2;

/** The credential material searched for everywhere: tokens, the App key, GitHub's error body, the header scheme. */
const CANARIES = [
  CANARY, CANARY_ERROR_BODY, ...canaryAppKey(), 'ghp_', 'gho_', 'ghs_', 'Bearer ', 'eyJhbGci',
  // The ETags the links store and GitHub's host: never in a response, a log or a job param (security checklist 5).
  'W/"old"', 'W/"g1"', 'W/"g2"', 'api.github.com',
];

/** A GitHub failure the link routes can meet, with the issue-read answer that causes it. */
const GITHUB_FAILURES: Array<[string, () => GithubCase]> = [
  ['401', unauthorized],
  ['403', forbidden],
  ['404', notFound],
  ['rate limit', () => rateLimited(new Date(Date.UTC(2099, 0, 1)))],
  ['5xx', serverError],
  ['timeout', timeout],
  ['moved', () => issueMoved()],
  ['a pull request', () => issueCase(githubPullRequest({ number: CANARY_NUMBER }))],
];

describe('Issues credential canary sweep (real MySQL)', () => {
  let harness: IssuesCanaryHarness;
  const responses: request.Response[] = [];
  const secrets = new Set<string>();
  const jobs: string[] = [];
  const enqueued: Array<{ name: string; params: Record<string, unknown> }> = [];

  beforeAll(async () => {
    harness = await buildIssuesCanaryHarness({ KERGHAN_ISSUES_LINK_MAX_PER_WINDOW: `${LIMIT}`, KERGHAN_ISSUES_EDIT_MAX_PER_WINDOW: `${LIMIT}` });
  });

  afterAll(() => harness.close());

  afterEach(() => collectJobs());

  function collectJobs(): void {
    jobs.push(serializeJobs(harness.workers));
    enqueued.push(...harness.workers.enqueued.map(({ name, params }) => ({ name, params: { ...params } })));
  }

  const canaries = (): string[] => [...CANARIES, ...secrets];

  /** Seeds the world (collecting the previous test's jobs first), and remembers every stored secret form. */
  async function world(types: IntegrationType[] = ['pat']): Promise<CanaryWorld> {
    collectJobs();

    const built = await buildCanaryWorld(harness, types);

    for (const row of built.integrations) {
      for (const column of [row.secretIv, row.secretAuthTag, row.secretCiphertext]) {
        secrets.add(Buffer.from(column).toString('hex'));
        secrets.add(Buffer.from(column).toString('base64'));
      }
    }

    return built;
  }

  /** Runs a request, checks its answer at once, and keeps it for the final sweep. */
  async function record(pending: request.Test): Promise<request.Response> {
    const response = await pending;

    responses.push(response);
    expectNoCanary([serializeResponse(response)], canaries());

    return response;
  }

  const resolve = (row: RouteRow, w: CanaryWorld): string => row.path.replace(PROJECT_ID, w.project.uuid).replace(ISSUE_ID, w.issue.uuid);
  const isLinked = (row: RouteRow): boolean => LINKED_ROUTES.some((suffix) => row.path.endsWith(suffix));
  const bodyOf = (row: RouteRow): Record<string, unknown> => (row.path.endsWith('from-repository.json') ? { repository: { githubId: 700 } } : row.body);
  const send = (row: RouteRow, w: CanaryWorld, cookie = w.cookie, body = bodyOf(row)) => record(postAs(harness, resolve(row, w), cookie, body));

  const remote = (title: string, updatedAt = '2026-06-01T11:00:00Z', etag = 'W/"g1"') => remoteIssue(
    { title, body: 'Local body', local: 'Local', now: harness.clock.now() }, title, updatedAt, etag,
  );
  const linkIssue = (w: CanaryWorld, marker = false) => linkIssueOf(harness, w, marker);

  describe('every route (testing.md#security-verification: the credential canary)', () => {
    it('covers every route the Issues module registers', () => {
      expect(registeredRoutes()).toEqual(ROUTE_ROWS.map((row) => `POST ${row.path}`).sort());
    });

    describe.each(ROUTE_ROWS.map((row) => [`POST ${row.path}`, row] as const))('%s', (_name, row) => {
      it.each(TYPES)('runs as the owner with a %s credential, with GitHub answering', async (type) => {
        const w = await world([type]);

        if (isLinked(row)) await linkIssue(w);
        harness.github.reads(remote('Base', '2026-06-01T11:00:00Z')).writes(remote('New', '2026-06-01T13:00:00Z', 'W/"g2"'));

        await send(row, w);
      });

      it('answers 404 for a missing project, 404 to the intruder on the owner\'s project, and 400 for a bad body or id', async () => {
        const w = await world();

        if (row.path.includes(PROJECT_ID)) {
          expect((await record(postAs(harness, resolve(row, w).replace(w.project.uuid, MISSING), w.cookie, bodyOf(row)))).status).toBe(404);
          expect((await send(row, w, harness.intruderCookie())).status).toBe(404);
        }
        if (row.invalidBody) expect((await send(row, w, w.cookie, row.invalidBody)).status).toBe(400);
        if (row.path.includes(ISSUE_ID)) expect((await record(postAs(harness, resolve(row, w).replace(w.issue.uuid, 'not-a-uuid'), w.cookie, bodyOf(row)))).status).toBe(400);
      });

      it('answers 409 PROJECT_HAS_NO_REPOSITORY style refusals when the project has no repository, and 401 without a session', async () => {
        const w = await world(['github_app']);

        await harness.ds.query('UPDATE issues_projects SET repository_id = NULL WHERE id = ?', [w.project.id]);
        if (isLinked(row)) await linkIssue(w);
        await send(row, w);
        expect((await record(postAs(harness, resolve(row, w), 'access_token=nope', bodyOf(row)))).status).toBe(401);
      });
    });
  });

  describe('every GitHub failure on a link creation (E57 to E60)', () => {
    describe.each(['import.json', 'attach.json'].map((suffix) => [suffix, ROUTE_ROWS.find((row) => row.path.endsWith(suffix)) as RouteRow] as const))('%s', (_name, row) => {
      it.each(TYPES.flatMap((type) => GITHUB_FAILURES.map(([label, answer]) => [type, label, answer] as const)))(
        'with a %s credential answers a GitHub %s without leaking',
        async (type, _label, answer) => {
          const w = await world([type]);

          harness.github.reads(answer());
          expect((await send(row, w)).status).toBeGreaterThanOrEqual(400);
        },
      );
    });

    it('answers 409 GITHUB_ISSUE_ALREADY_LINKED with its meta, and 304 reads do not break the read', async () => {
      const w = await world();
      const row = ROUTE_ROWS.find((candidate) => candidate.path.endsWith('import.json')) as RouteRow;

      harness.github.reads(remote('Dup'));
      expect((await send(row, w)).status).toBe(201);
      expect((await send(row, w)).status).toBe(409);

      harness.github.reads(notModified());
      await send(row, w);
    });
  });

  describe('the rate limits answer 429 without leaking (testing.md#security-verification)', () => {
    it('answers 429 ISSUE_LINK_RATE_LIMITED past the link window on import.json', async () => {
      const row = ROUTE_ROWS.find((candidate) => candidate.path.endsWith('import.json')) as RouteRow;
      const w = await world(['oauth_app']);
      const statuses: number[] = [];

      harness.github.reads(remote('Window'));
      for (let call = 0; call <= LIMIT; call += 1) statuses.push((await send(row, w, w.cookie, { number: CANARY_NUMBER + call })).status);

      expect(statuses.at(-1)).toBe(429);
    });

    it('answers 429 ISSUE_EDIT_RATE_LIMITED past the edit window on a linked issue, every accepted edit enqueuing { linkId }', async () => {
      const row = ROUTE_ROWS.find((candidate) => candidate.path.includes('/issues/') && candidate.path.endsWith('/edit.json')) as RouteRow;
      const w = await world(['pat']);
      const statuses: number[] = [];

      await linkIssue(w);
      for (let call = 0; call <= LIMIT; call += 1) statuses.push((await send(row, w, w.cookie, { title: `Edit ${call}` })).status);

      expect(statuses).toEqual([200, 200, 429]);
    });
  });

  describe('every sync outcome (testing.md#security-verification: E17, E19 to E22, E24, exhausted retries)', () => {
    /** Reads the link and issue back through the routes, as the owner and as the intruder. */
    async function readBack(w: CanaryWorld): Promise<void> {
      const base = `/projects/${w.project.uuid}`;

      await record(postAs(harness, `${base}/issues/${w.issue.uuid}/show.json`, w.cookie));
      await record(postAs(harness, `${base}/issues.json`, w.cookie, { state: 'all' }));
      await record(postAs(harness, `${base}/show.json`, w.cookie));
      await record(postAs(harness, '/projects/mine.json', w.cookie));
      await record(postAs(harness, `${base}/issues/${w.issue.uuid}/show.json`, harness.intruderCookie()));
    }

    describe.each(TYPES)('with a %s credential', (type) => {
      it.each(SYNC_OUTCOMES.filter((outcome) => outcome.noIntegration !== true && outcome.denyOwner !== true).map((outcome) => [outcome.title, outcome] as const))(
        '%s',
        async (_title, outcome) => {
          const w = await world([type]);

          await runOutcome(harness, w, outcome);
          await readBack(w);
        },
      );
    });

    it.each(SYNC_OUTCOMES.filter((outcome) => outcome.noIntegration === true || outcome.denyOwner === true).map((outcome) => [outcome.title, outcome] as const))(
      '%s',
      async (_title, outcome) => {
        const w = await world(outcome.noIntegration ? [] : ['github_app']);

        await runOutcome(harness, w, outcome);
        await readBack(w);
      },
    );
  });

  describe('the whole sweep (testing.md#security-verification)', () => {
    it('ran a body of requests with real failures and successes (the sweep is not vacuous)', () => {
      const statuses = new Set(responses.map((response) => response.status));

      expect(responses.length).toBeGreaterThan(300);
      [200, 201, 202, 400, 401, 404, 409].forEach((status) => expect(statuses).toContain(status));
      expect([...statuses].some((status) => status >= 500 || status === 429)).toBe(true);
    });

    it('leaks no credential in any response body, header or error.meta', () => {
      expectNoCanary(responses.map(serializeResponse), canaries());
    });

    it('carries no internal id, user id, integration field or deletion column in any body, error.meta included (data-access checklist 3)', () => {
      // `meta.projectId` / `meta.issueId` of a 409 are public uuids (the winner's), allowed in errors only.
      const allowedInMeta = ['projectId', 'issueId'];

      for (const response of responses) {
        const forbidden = FORBIDDEN_BODY_KEYS.filter((key) => !(response.status >= 400 && allowedInMeta.includes(key)));

        expect(keysOf(response.body).filter((key) => forbidden.includes(key))).toEqual([]);
      }
    });

    it('leaks no credential in any captured log line, and logged the requests', () => {
      expect(harness.logs.info).toHaveBeenCalledWith('request', expect.objectContaining({ method: 'POST' }));
      expectNoCanary([serializeLogs(harness.logs)], canaries());
    });

    it('records no credential in any job param or job log', () => {
      collectJobs();
      expectNoCanary(jobs, canaries());
    });

    it('enqueued only { linkId } with a positive integer, in every job of the sweep (job params allowlist)', () => {
      expect(enqueued.length).toBeGreaterThan(0);
      enqueued.forEach((entry) => {
        expect(entry.name).toBe(ISSUES_RECONCILE_JOB);
        expect(Object.keys(entry.params)).toEqual(['linkId']);
        expect(Number.isInteger(entry.params.linkId) && (entry.params.linkId as number) > 0).toBe(true);
      });
    });
  });
});
