import { buildIssuesHttpDbHarness, type IssuesHttpDbHarness } from './support/issues-http-db-harness.js';
import { seedIssue } from './support/issues-seeds.js';
import { addLinkUser, buildLinkWorld, linkApi, type LinkWorld, scriptIssue } from './support/link-fixture.js';

// The per-user link-creation window (`docs/agents/modules/issues/security.md#request-rate-limits`): import and attach share
// it, it answers before the access check, and a refused call consumes nothing.
const MAX = 3;
const MISSING = '00000000-0000-4000-8000-000000000000';

describe('Issue link rate limit (real MySQL)', () => {
  let harness: IssuesHttpDbHarness;
  let world: LinkWorld;

  beforeAll(async () => {
    harness = await buildIssuesHttpDbHarness({ KERGHAN_ISSUES_LINK_MAX_PER_WINDOW: `${MAX}` });
  });

  afterAll(() => harness.close());

  beforeEach(async () => {
    world = await buildLinkWorld(harness);
  });

  const api = () => linkApi(harness, world);
  const importNumber = (number: number) => {
    scriptIssue(harness, { number });

    return api().importIssue({ number });
  };

  async function fillWindow(): Promise<void> {
    for (let number = 1; number <= MAX; number += 1) await importNumber(number).expect(201);
  }

  it('answers 429 ISSUE_LINK_RATE_LIMITED with Retry-After once the window is full', async () => {
    await fillWindow();
    harness.clock.advance(20_000);

    const refused = await importNumber(99).expect(429);

    expect(refused.headers['retry-after']).toBe('40');
    expect(refused.body.error).toEqual({
      code: 'ISSUE_LINK_RATE_LIMITED',
      message: expect.any(String),
      retryAfterSeconds: 40,
    });
  });

  it('shares the window between import and attach', async () => {
    const locals = await Promise.all([1, 2].map(() => seedIssue(harness.ds, world.project.id, { title: 'x' })));

    await importNumber(1).expect(201);

    for (const [index, local] of locals.entries()) {
      scriptIssue(harness, { number: 50 + index, title: 'x', body: null });
      await api().attach(local.uuid, { number: 50 + index }).expect(200);
    }

    await importNumber(2).expect(429);
  });

  it('answers 429 before the access check: a missing project is still 429 once over the limit', async () => {
    await fillWindow();

    const refused = await linkApi(harness, { ...world, project: { id: 0, uuid: MISSING } }).importIssue({ number: 1 }).expect(429);

    expect(refused.body.error.code).toBe('ISSUE_LINK_RATE_LIMITED');
  });

  it('lets a refused call consume nothing: the window reopens at its original end', async () => {
    await fillWindow();
    await importNumber(98).expect(429);
    await importNumber(97).expect(429);

    harness.clock.advance(60_000);

    await importNumber(96).expect(201);
  });

  it('does not count validation errors, nor limit unlink', async () => {
    for (let index = 0; index < MAX + 2; index += 1) await api().importIssue({ number: 0 }).expect(400);

    const local = await seedIssue(harness.ds, world.project.id);

    await fillWindow();
    await api().unlink(local.uuid).expect(409);
    await importNumber(95).expect(429);
  });

  it('keeps one window per user', async () => {
    await fillWindow();

    const other = await addLinkUser(harness, 'second');

    scriptIssue(harness, { number: 77 });
    await linkApi(harness, other).importIssue({ number: 77 }).expect(201);
  });
});
