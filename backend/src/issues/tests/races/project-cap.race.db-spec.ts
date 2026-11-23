import { seedUser } from '../../../repositories/tests/support/two-user-baseline.js';
import { IssuesProject } from '../../entities/issues-project.entity.js';
import { ProjectsService } from '../../projects.service.js';
import { buildIssuesDbHarness, type IssuesDbHarness } from '../support/issues-db-harness.js';
import { seedProject } from '../support/issues-seeds.js';

// The cap is checked under the exclusive user-row lock (`lockExistingUserForUpdate`); with a shared
// lock two creations at `max - 1` would both pass. Proves the exclusive lock of the creating
// transaction (`docs/agents/modules/issues/security.md#per-user-caps-on-stored-data`).
const CAP = 3;

describe('Live-project cap race (real MySQL)', () => {
  let harness: IssuesDbHarness;
  let service: ProjectsService;
  let userId: number;

  beforeAll(async () => {
    harness = await buildIssuesDbHarness({ KERGHAN_ISSUES_MAX_PROJECTS_PER_USER: `${CAP}` });
    service = harness.get(ProjectsService);
  });

  afterAll(() => harness.close());

  beforeEach(async () => {
    userId = await seedUser(harness.ds, 'owner');
  });

  const liveCount = (): Promise<number> => harness.ds.getRepository(IssuesProject).countBy({ userId, deletedToken: 0 });

  it.each([1, 2, 3, 4, 5])('lets exactly one of two simultaneous creations at max - 1 pass (run %i)', async (run) => {
    for (let index = 0; index < CAP - 1; index += 1) await seedProject(harness.ds, userId, { name: `seed ${run} ${index}` });

    const outcomes = await Promise.all(['x', 'y'].map((name) => (
      service.create(userId, { name, description: null, repository: null }, 'explicit').then(
        () => 'created',
        (error: { response?: { code?: string } }) => error.response?.code ?? 'other',
      )
    )));

    expect(outcomes.sort()).toEqual(['PROJECTS_LIMIT_REACHED', 'created']);
    expect(await liveCount()).toBe(CAP);
  });

  it('never overshoots with many simultaneous creations', async () => {
    const outcomes = await Promise.all(Array.from({ length: 8 }, (_unused, index) => (
      service.create(userId, { name: `p${index}`, description: null, repository: null }, 'explicit').then(
        () => 'created',
        (error: { response?: { code?: string } }) => error.response?.code ?? 'other',
      )
    )));

    expect(outcomes.filter((outcome) => outcome === 'created')).toHaveLength(CAP);
    expect(outcomes.filter((outcome) => outcome === 'PROJECTS_LIMIT_REACHED')).toHaveLength(8 - CAP);
    expect(await liveCount()).toBe(CAP);
  });
});
