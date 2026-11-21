import { seedUser } from '../../../repositories/tests/support/two-user-baseline.js';
import { Issue } from '../../entities/issue.entity.js';
import { IssuesService } from '../../issues.service.js';
import { buildIssuesDbHarness, type IssuesDbHarness } from '../support/issues-db-harness.js';
import { seedIssue, seedProject } from '../support/issues-seeds.js';

// The cap is checked under the exclusive project row lock; with a shared lock two creations at
// `max - 1` would both pass (`security.md#per-project-caps-on-stored-data`).
const CAP = 3;

describe('Issue cap race (real MySQL)', () => {
  let harness: IssuesDbHarness;
  let service: IssuesService;
  let userId: number;
  let projectId: number;
  let projectUuid: string;

  beforeAll(async () => {
    harness = await buildIssuesDbHarness({ KERGHAN_ISSUES_MAX_ISSUES_PER_PROJECT: `${CAP}` });
    service = harness.get(IssuesService);
  });

  afterAll(() => harness.close());

  beforeEach(async () => {
    userId = await seedUser(harness.ds, 'owner');
    const project = await seedProject(harness.ds, userId);

    projectId = project.id;
    projectUuid = project.uuid;
  });

  const count = (): Promise<number> => harness.ds.getRepository(Issue).countBy({ projectId });
  const create = (title: string): Promise<string> => (
    service.create(userId, projectUuid, { title, body: null, state: 'open' }).then(
      () => 'created',
      (error: { response?: { code?: string } }) => error.response?.code ?? 'other',
    )
  );

  it.each([1, 2, 3, 4, 5])('lets exactly one of two simultaneous creations at max - 1 pass (run %i)', async (run) => {
    for (let index = 0; index < CAP - 1; index += 1) await seedIssue(harness.ds, projectId, { title: `seed ${run} ${index}` });

    const outcomes = await Promise.all(['x', 'y'].map(create));

    expect(outcomes.sort()).toEqual(['ISSUES_LIMIT_REACHED', 'created']);
    expect(await count()).toBe(CAP);
  });

  it('never overshoots with many simultaneous creations', async () => {
    const outcomes = await Promise.all(Array.from({ length: 8 }, (_unused, index) => create(`i${index}`)));

    expect(outcomes.filter((outcome) => outcome === 'created')).toHaveLength(CAP);
    expect(outcomes.filter((outcome) => outcome === 'ISSUES_LIMIT_REACHED')).toHaveLength(8 - CAP);
    expect(await count()).toBe(CAP);
  });
});
