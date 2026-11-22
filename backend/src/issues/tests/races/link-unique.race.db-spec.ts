import { buildIssuesHttpDbHarness, type IssuesHttpDbHarness } from '../support/issues-http-db-harness.js';
import { seedIssue } from '../support/issues-seeds.js';
import { buildLinkWorld, linkApi, type LinkWorld, rowCount, scriptIssue, seedSecondProject } from '../support/link-fixture.js';

// The unique indexes behind E4 and E64 under concurrency: of two simultaneous creations, one wins
// and the other answers the documented 409 (E46); neither ever answers a 500.
const RUNS = [1, 2, 3, 4, 5];

describe('Link uniqueness races (real MySQL)', () => {
  let harness: IssuesHttpDbHarness;
  let world: LinkWorld;

  beforeAll(async () => {
    harness = await buildIssuesHttpDbHarness({ KERGHAN_ISSUES_LINK_MAX_PER_WINDOW: '1000' });
  });

  afterAll(() => harness.close());

  beforeEach(async () => {
    world = await buildLinkWorld(harness);
  });

  const codeOf = (response: { status: number; body: { error?: { code?: string } } }): string => (
    response.status < 300 ? String(response.status) : response.body.error?.code ?? 'other'
  );

  it.each(RUNS)('lets one of two concurrent imports of one GitHub issue win, in one project (run %i)', async () => {
    scriptIssue(harness, { id: 2 ** 31 + 7_000, number: 12 });

    const outcomes = await Promise.all([1, 2].map(async () => codeOf(await linkApi(harness, world).importIssue())));

    expect(outcomes.sort()).toEqual(['201', 'GITHUB_ISSUE_ALREADY_LINKED']);
    expect(await rowCount(harness, 'issues_github_links')).toBe(1);
    expect(await rowCount(harness, 'issues')).toBe(1);
  });

  it.each(RUNS)('lets one of two concurrent imports win from two projects, which hold different locks (run %i)', async () => {
    const second = await seedSecondProject(harness, world.userId);

    scriptIssue(harness, { id: 2 ** 31 + 7_100, number: 12 });

    const outcomes = await Promise.all([world.project, second].map(
      async (project) => codeOf(await linkApi(harness, { ...world, project }).importIssue()),
    ));

    expect(outcomes.sort()).toEqual(['201', 'GITHUB_ISSUE_ALREADY_LINKED']);
    expect(await rowCount(harness, 'issues_github_links')).toBe(1);
    expect(await rowCount(harness, 'issues')).toBe(1);
  });

  it.each(RUNS)('lets one of two attaches of different GitHub issues to one issue win (run %i)', async () => {
    const local = await seedIssue(harness.ds, world.project.id, { title: 'Same', body: null });

    scriptIssue(harness, { id: 2 ** 31 + 7_200, number: 12, title: 'Same', body: null });
    scriptIssue(harness, { id: 2 ** 31 + 7_201, number: 13, title: 'Same', body: null });

    const outcomes = await Promise.all([12, 13].map(
      async (number) => codeOf(await linkApi(harness, world).attach(local.uuid, { number })),
    ));

    expect(outcomes.sort()).toEqual(['200', 'ISSUE_ALREADY_LINKED']);
    expect(await rowCount(harness, 'issues_github_links')).toBe(1);
  });
});
