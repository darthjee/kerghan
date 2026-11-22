import { expectNoCanary, serializeLogs } from './support/canary-assertions.js';
import { buildCanaryWorld, CANARY_NUMBER } from './support/canary-world.js';
import { buildIssuesCanaryHarness, postAs, type IssuesCanaryHarness } from './support/issues-canary-harness.js';
import { seedLink, seedMarker } from './support/issues-seeds.js';
import { notFound, timeout } from '../../integrations/tests/support/github-builders.js';
import { CANARY_INSTALLATION_TOKEN, CANARY_OAUTH_TOKEN, CANARY_PAT } from '../../integrations/tests/support/integrations-github-harness.js';

// The harness the canary sweeps run on: it must really carry a credential to the wire (otherwise a
// sweep that finds nothing proves nothing), log requests, and run the real job with its retries.
describe('Issues canary harness (real MySQL)', () => {
  let harness: IssuesCanaryHarness;

  beforeAll(async () => {
    harness = await buildIssuesCanaryHarness();
  });

  afterAll(() => harness.close());

  const importPath = (projectUuid: string) => `/projects/${projectUuid}/issues/import.json`;

  it.each([
    ['pat', CANARY_PAT],
    ['oauth_app', CANARY_OAUTH_TOKEN],
    ['github_app', CANARY_INSTALLATION_TOKEN],
  ] as const)('sends the %s credential of the real Integrations services to GitHub only', async (type, secret) => {
    const world = await buildCanaryWorld(harness, [type]);
    const response = await postAs(harness, importPath(world.project.uuid), world.cookie, { number: CANARY_NUMBER });

    expect(response.status).toBe(201);
    expect(harness.github.issueCalls().map((call) => call.authorization)).toEqual([`Bearer ${secret}`]);
    expect(harness.github.calls.every((call) => call.url.startsWith('https://api.github.com/'))).toBe(true);
    expectNoCanary([response.text, JSON.stringify(response.headers), serializeLogs(harness.logs)], [secret]);
  });

  it('mounts the request-logging chain and captures every log line', async () => {
    const world = await buildCanaryWorld(harness);

    await postAs(harness, importPath(world.project.uuid), world.cookie, { number: CANARY_NUMBER });

    expect(harness.logs.info).toHaveBeenCalledWith('request', expect.objectContaining({ method: 'POST', statusCode: 201, requestId: expect.any(String) }));
  });

  it('scripts GitHub per test: a 404 answers the import 404 after the one read', async () => {
    const world = await buildCanaryWorld(harness);

    harness.github.reads(notFound());

    const response = await postAs(harness, importPath(world.project.uuid), world.cookie, { number: CANARY_NUMBER });

    expect(response.status).toBe(404);
    expect(harness.github.issueCalls().map((call) => `${call.method} ${call.url.replace('https://api.github.com', '')}`)).toEqual([
      'GET /repos/darthjee/kerghan/issues/12',
    ]);
  });

  it('drains the queue with the real issues.reconcile job, retrying a transient failure until it is exhausted', async () => {
    const world = await buildCanaryWorld(harness);
    const created = await seedLinkWithMarker(world);

    harness.workers.enqueue('issues.reconcile', { linkId: created });
    harness.github.reads(timeout());

    const report = await harness.drainJobs();

    // Four attempts fail and retry; the fifth is the last one: it records the failure and ends cleanly.
    expect(report).toEqual({ jobs: 1, attempts: 5 });
    expect(harness.workers.errors).toHaveLength(4);
    await expect(harness.ds.query('SELECT status, status_reason FROM issues_github_links WHERE id = ?', [created]))
      .resolves.toEqual([{ status: 'sync_failed', status_reason: 'retries_exhausted' }]);
  });

  async function seedLinkWithMarker(world: Awaited<ReturnType<typeof buildCanaryWorld>>): Promise<number> {
    const link = await seedLink(harness.ds, { userId: world.userId, issueId: world.issue.id, githubNumber: CANARY_NUMBER });

    await seedMarker(harness.ds, link.id);

    return link.id;
  }
});
