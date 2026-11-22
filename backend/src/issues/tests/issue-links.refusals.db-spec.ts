import type request from 'supertest';
import { integrationRef } from './support/integration-refs.js';
import { buildIssuesHttpDbHarness, type IssuesHttpDbHarness } from './support/issues-http-db-harness.js';
import { seedIssue, seedProject } from './support/issues-seeds.js';
import { buildLinkWorld, INTEGRATION_ID, linkApi, linkRepository, type LinkWorld, rowCount, scriptIssue } from './support/link-fixture.js';
import type { FakeAnswer } from '../../integrations/tests/support/fake-integrations-github.service.js';
import {
  forbidden,
  githubPullRequest,
  issueGone,
  issueMoved,
  issueRedirectOffHost,
  notFound,
  rateLimited,
  serverError,
  timeout,
  unauthorized,
} from '../../integrations/tests/support/github-builders.js';

// Every refusal of a link creation leaves the issue, link and marker tables as they were
// (`api/github-link.md#order-of-checks-import-and-attach`, E3, E57 to E60).
describe('Issue link refusals (real MySQL)', () => {
  let harness: IssuesHttpDbHarness;
  let world: LinkWorld;

  beforeAll(async () => {
    harness = await buildIssuesHttpDbHarness();
  });

  afterAll(() => harness.close());

  beforeEach(async () => {
    world = await buildLinkWorld(harness);
  });

  const api = () => linkApi(harness, world);
  const script = (...answers: FakeAnswer[]) => harness.github.script(INTEGRATION_ID, 'getIssue', 12, ...answers);

  /** Both link routes, so every refusal is proved on import and on attach. */
  const routes = (): Array<[string, () => Promise<request.Response>]> => [
    ['import', async () => api().importIssue()],
    ['attach', async () => {
      const local = await seedIssue(harness.ds, world.project.id, { title: 'Local' });

      return api().attach(local.uuid);
    }],
  ];

  /** The tables are exactly as a refused call found them: no link, no marker, only the local issues. */
  async function expectUntouched(issues = 0): Promise<void> {
    expect(await rowCount(harness, 'issues')).toBe(issues);
    expect(await rowCount(harness, 'issues_github_links')).toBe(0);
    expect(await rowCount(harness, 'issues_pending_writes')).toBe(0);
  }

  describe.each(routes())('on %s', (kind, run) => {
    const locals = kind === 'attach' ? 1 : 0;

    it('answers 409 PROJECT_HAS_NO_REPOSITORY for a project without a repository, with no GitHub call', async () => {
      const bare = await seedProject(harness.ds, world.userId, { name: 'bare' });

      world = { ...world, project: bare };
      const response = await run();

      expect(response.status).toBe(409);
      expect(response.body.error.code).toBe('PROJECT_HAS_NO_REPOSITORY');
      expect(harness.github.githubCalls()).toEqual([]);
      await expectUntouched(locals);
    });

    it('answers 409 PROJECT_REPOSITORY_UNAVAILABLE for an Unavailable repository, with no GitHub call', async () => {
      linkRepository(harness, world.userId, 'unavailable');

      const response = await run();

      expect(response.status).toBe(409);
      expect(response.body.error.code).toBe('PROJECT_REPOSITORY_UNAVAILABLE');
      expect(harness.github.githubCalls()).toEqual([]);
      await expectUntouched(locals);
    });

    it('answers 409 PROJECT_REPOSITORY_UNAVAILABLE for a dangling repository, with no GitHub call', async () => {
      harness.repositories.reset();

      const response = await run();

      expect(response.body.error.code).toBe('PROJECT_REPOSITORY_UNAVAILABLE');
      expect(harness.github.githubCalls()).toEqual([]);
      await expectUntouched(locals);
    });

    it('allows an Unknown repository', async () => {
      linkRepository(harness, world.userId, 'unknown');
      scriptIssue(harness);

      await run();

      // The repository check passed: GitHub was read (an attach then asks to confirm its values).
      expect(harness.github.githubCalls()).toHaveLength(1);
    });

    it('answers 422 GITHUB_ISSUE_IS_PULL_REQUEST for a pull request (E3)', async () => {
      script({ ...scriptedPullRequest() });

      const response = await run();

      expect(response.status).toBe(422);
      expect(response.body.error.code).toBe('GITHUB_ISSUE_IS_PULL_REQUEST');
      await expectUntouched(locals);
    });

    it.each([
      ['not found', notFound()],
      ['gone', issueGone()],
      ['moved', issueMoved()],
    ])('answers 404 GITHUB_ISSUE_NOT_FOUND when GitHub says %s (E57)', async (_label, answer) => {
      script(answer);

      const response = await run();

      expect(response.status).toBe(404);
      expect(response.body.error).toMatchObject({ code: 'GITHUB_ISSUE_NOT_FOUND', message: 'GitHub issue not found' });
      await expectUntouched(locals);
    });

    it('answers 503 GITHUB_RATE_LIMITED with the delay, and makes no wait (E58)', async () => {
      script(rateLimited(new Date(harness.clock.now().getTime() + 90_000)));

      const response = await run();

      expect(response.status).toBe(503);
      expect(response.body.error).toMatchObject({ code: 'GITHUB_RATE_LIMITED', retryAfterSeconds: 90 });
      expect(response.headers['retry-after']).toBe('90');
      await expectUntouched(locals);
    });

    it('answers 409 GITHUB_CREDENTIAL_UNUSABLE no_credential when no integration lists the repository (E59)', async () => {
      harness.repositories.seed(world.userId, { repositoryId: 7001, githubId: 700, owner: 'darthjee', name: 'kerghan', integrationSourceIds: [] });

      const response = await run();

      expect(response.status).toBe(409);
      expect(response.body.error).toMatchObject({ code: 'GITHUB_CREDENTIAL_UNUSABLE', meta: { reason: 'no_credential' } });
      expect(harness.github.githubCalls()).toEqual([]);
      await expectUntouched(locals);
    });

    it('answers no_credential when no integration is usable and none lists the repository (E59)', async () => {
      harness.github.setUsable(world.userId, []);
      harness.github.setIntegrations(world.userId, []);

      const response = await run();

      expect(response.body.error.meta).toEqual({ reason: 'no_credential' });
    });

    it('answers credential_invalid when the integration that lists the repository is unusable (E59)', async () => {
      harness.github.setUsable(world.userId, []);
      harness.github.setIntegrations(world.userId, [integrationRef(INTEGRATION_ID)]);

      const response = await run();

      expect(response.body.error).toMatchObject({ code: 'GITHUB_CREDENTIAL_UNUSABLE', meta: { reason: 'credential_invalid' } });
      expect(harness.github.githubCalls()).toEqual([]);
    });

    it.each([
      ['a 401', unauthorized(), 'credential_invalid'],
      ['a 403', forbidden(), 'forbidden'],
    ])('answers GITHUB_CREDENTIAL_UNUSABLE for %s from the only candidate (E59)', async (_label, answer, reason) => {
      script(answer);

      const response = await run();

      expect(response.status).toBe(409);
      expect(response.body.error).toMatchObject({ code: 'GITHUB_CREDENTIAL_UNUSABLE', meta: { reason } });
      await expectUntouched(locals);
    });

    it.each([
      ['a timeout', timeout()],
      ['a 5xx', serverError()],
      ['an unclassifiable 301', issueRedirectOffHost()],
    ])('answers 502 GITHUB_UNAVAILABLE for %s (E60)', async (_label, answer) => {
      script(answer);

      const response = await run();

      expect(response.status).toBe(502);
      expect(response.body.error.code).toBe('GITHUB_UNAVAILABLE');
      await expectUntouched(locals);
    });
  });

  /** A GitHub pull request answer for number 12. */
  function scriptedPullRequest(): FakeAnswer {
    return { name: 'pull request', raw: null, resultFor: () => ({ kind: 'ok', issue: githubPullRequest({ number: 12 }), etag: null }) };
  }
});
