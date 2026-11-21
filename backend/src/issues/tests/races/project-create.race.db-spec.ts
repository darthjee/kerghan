import { ConflictException } from '@nestjs/common';
import { seedUser } from '../../../repositories/tests/support/two-user-baseline.js';
import { IssuesProject } from '../../entities/issues-project.entity.js';
import { ProjectsService } from '../../projects.service.js';
import type { CreationResult } from '../../types/projects-api.types.js';
import { buildIssuesDbHarness, type IssuesDbHarness } from '../support/issues-db-harness.js';
import { seedProject } from '../support/issues-seeds.js';

// E34 and E35 (`docs/agents/specs/issues/edge-cases.md`): the unique indexes decide simultaneous
// creations and renames. The checks before the insert run for both callers first (the barrier
// below), so both reach the insert and the database picks the winner.

type Outcome = { ok: CreationResult } | { error: unknown };

/**
 * Runs the calls at once.
 * @param calls - The calls.
 * @returns Their settled outcomes.
 */
async function together<T>(calls: Array<() => Promise<T>>): Promise<Array<{ ok: T } | { error: unknown }>> {
  return Promise.all(calls.map((run) => run().then((ok) => ({ ok }), (error: unknown) => ({ error }))));
}

function codeOf(outcome: Outcome): string | undefined {
  return 'error' in outcome ? ((outcome.error as ConflictException).getResponse() as { code: string }).code : undefined;
}

describe('Project creation and rename races (real MySQL)', () => {
  let harness: IssuesDbHarness;
  let service: ProjectsService;
  let userId: number;

  beforeAll(async () => {
    harness = await buildIssuesDbHarness();
    service = harness.get(ProjectsService);
  });

  afterAll(() => harness.close());

  beforeEach(async () => {
    userId = await seedUser(harness.ds, 'owner');
    harness.repositories.seed(userId, { repositoryId: 901, githubId: 91, owner: 'o', name: 'r' });
  });

  const live = (): Promise<IssuesProject[]> => harness.ds.getRepository(IssuesProject).findBy({ userId, deletedToken: 0 });

  it.each([1, 2, 3])('E34: two explicit creations on one repository leave one 201 and one PROJECT_REPOSITORY_TAKEN (run %i)', async () => {
    const outcomes = await together([
      () => service.create(userId, { name: 'One', description: null, repository: { githubId: 91 } }, 'explicit'),
      () => service.create(userId, { name: 'Two', description: null, repository: { githubId: 91 } }, 'explicit'),
    ]) as Outcome[];

    expect(outcomes.filter((outcome) => 'ok' in outcome)).toHaveLength(1);
    expect(outcomes.map(codeOf).filter(Boolean)).toEqual(['PROJECT_REPOSITORY_TAKEN']);
    expect(await live()).toHaveLength(1);

    const loser = outcomes.find((outcome) => 'error' in outcome) as { error: ConflictException };
    const winner = outcomes.find((outcome) => 'ok' in outcome) as { ok: CreationResult };

    expect((loser.error.getResponse() as { meta: { projectId: string } }).meta.projectId).toBe(winner.ok.project.id);
  });

  it.each([1, 2, 3])('E34: two shortcuts on one repository leave one 201 and one 200 with the same project (run %i)', async () => {
    const outcomes = await together([
      () => service.create(userId, { description: null, repository: { githubId: 91 } }, 'shortcut'),
      () => service.create(userId, { description: null, repository: { githubId: 91 } }, 'shortcut'),
    ]) as Outcome[];

    const results = outcomes.map((outcome) => ('ok' in outcome ? outcome.ok : null));

    expect(results.every((result) => result !== null)).toBe(true);
    expect((results as CreationResult[]).map((result) => result.status).sort()).toEqual([200, 201]);
    expect(results[0]?.project.id).toBe(results[1]?.project.id);
    expect(await live()).toHaveLength(1);
  });

  it.each([1, 2, 3])('E35: two creations to one name leave one 201 and one PROJECT_NAME_TAKEN (run %i)', async () => {
    const outcomes = await together([
      () => service.create(userId, { name: 'Same', description: null, repository: null }, 'explicit'),
      () => service.create(userId, { name: 'same', description: null, repository: null }, 'explicit'),
    ]) as Outcome[];

    expect(outcomes.filter((outcome) => 'ok' in outcome)).toHaveLength(1);
    expect(outcomes.map(codeOf).filter(Boolean)).toEqual(['PROJECT_NAME_TAKEN']);
    expect(await live()).toHaveLength(1);
  });

  it.each([1, 2, 3])('E35: two renames to one name leave one success and one PROJECT_NAME_TAKEN (run %i)', async () => {
    const first = await seedProject(harness.ds, userId, { name: 'first' });
    const second = await seedProject(harness.ds, userId, { name: 'second' });

    const outcomes = await together([
      () => service.edit(userId, first.uuid, { name: 'Target' }),
      () => service.edit(userId, second.uuid, { name: 'target' }),
    ]) as Outcome[];

    expect(outcomes.filter((outcome) => 'ok' in outcome)).toHaveLength(1);
    expect(outcomes.map(codeOf).filter(Boolean)).toEqual(['PROJECT_NAME_TAKEN']);
    expect((await live()).map((project) => project.name.toLowerCase()).sort()).toEqual(['first', 'target'].sort().length === 2
      ? expect.arrayContaining(['target'])
      : []);
  });

  it('E36: a repository and a name whose only project was deleted can be created again, at once, twice', async () => {
    await seedProject(harness.ds, userId, { name: 'Old', repositoryId: 901, deleted: true });

    const outcomes = await together([
      () => service.create(userId, { name: 'Old', description: null, repository: { githubId: 91 } }, 'explicit'),
      () => service.create(userId, { name: 'Old', description: null, repository: { githubId: 91 } }, 'explicit'),
    ]) as Outcome[];

    expect(outcomes.filter((outcome) => 'ok' in outcome)).toHaveLength(1);
    expect(await live()).toHaveLength(1);
  });
});
