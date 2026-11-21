import { ConflictException, NotFoundException } from '@nestjs/common';
import { ErrorCodes } from '../../core/error-codes.js';
import { seedUser } from '../../repositories/tests/support/two-user-baseline.js';
import { IssuesProject } from '../entities/issues-project.entity.js';
import { ProjectStore } from '../project-store.js';
import { ProjectsService } from '../projects.service.js';
import { buildIssuesDbHarness, HARNESS_START, type IssuesDbHarness } from './support/issues-db-harness.js';
import { seedIntruder, seedIssue, seedProject, SEED_TIME } from './support/issues-seeds.js';

describe('ProjectsService#edit (real MySQL)', () => {
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
    harness.clock.set(new Date(HARNESS_START.getTime() + 3_600_000));
  });

  const stored = (id: number): Promise<IssuesProject> => harness.ds.getRepository(IssuesProject).findOneByOrFail({ id });

  it('changes only the given field and bumps updated_at', async () => {
    const project = await seedProject(harness.ds, userId, { name: 'old', description: 'keep' });

    const result = await service.edit(userId, project.uuid, { name: 'new' });

    expect(result).toMatchObject({ name: 'new', description: 'keep', updatedAt: '2026-06-01T13:00:00.000Z' });
    expect(await stored(project.id)).toMatchObject({ name: 'new', description: 'keep', updatedAt: new Date('2026-06-01T13:00:00Z') });
  });

  it('changes the description alone, and clears it with null', async () => {
    const project = await seedProject(harness.ds, userId, { name: 'p', description: 'x' });

    expect((await service.edit(userId, project.uuid, { description: 'y' })).description).toBe('y');
    expect((await service.edit(userId, project.uuid, { description: null })).description).toBeNull();
    expect((await stored(project.id)).description).toBeNull();
    expect((await stored(project.id)).name).toBe('p');
  });

  it.each([
    ['an empty body', {}],
    ['values equal to the stored ones', { name: 'p', description: 'x' }],
  ])('answers 200 with no write and no updated_at change for %s', async (_label, input) => {
    const project = await seedProject(harness.ds, userId, { name: 'p', description: 'x' });
    const spy = jest.spyOn(harness.get(ProjectStore), 'update');

    const result = await service.edit(userId, project.uuid, input);

    expect(result).toMatchObject({ name: 'p', description: 'x', updatedAt: SEED_TIME.toISOString() });
    expect(spy).not.toHaveBeenCalled();
    expect((await stored(project.id)).updatedAt).toEqual(SEED_TIME);
    spy.mockRestore();
  });

  it('answers a clear of an already empty description as a no-op', async () => {
    const project = await seedProject(harness.ds, userId, { name: 'p' });
    const spy = jest.spyOn(harness.get(ProjectStore), 'update');

    await service.edit(userId, project.uuid, { description: null });

    expect(spy).not.toHaveBeenCalled();
    spy.mockRestore();
  });

  it('allows a case-only rename of the project itself', async () => {
    const project = await seedProject(harness.ds, userId, { name: 'roadmap' });

    expect((await service.edit(userId, project.uuid, { name: 'Roadmap' })).name).toBe('Roadmap');
    expect((await stored(project.id)).name).toBe('Roadmap');
  });

  it('refuses a name taken by another live project, case-insensitively, and writes nothing', async () => {
    await seedProject(harness.ds, userId, { name: 'Taken' });
    const project = await seedProject(harness.ds, userId, { name: 'mine' });

    const error = await service.edit(userId, project.uuid, { name: 'TAKEN' }).then(() => null, (e: unknown) => e as ConflictException);

    expect(error?.getResponse()).toEqual({ code: ErrorCodes.PROJECT_NAME_TAKEN, message: 'A project with this name already exists' });
    expect((await stored(project.id)).name).toBe('mine');
  });

  it('lets a deleted project\'s name be reused', async () => {
    await seedProject(harness.ds, userId, { name: 'Taken', deleted: true });
    const project = await seedProject(harness.ds, userId, { name: 'mine' });

    expect((await service.edit(userId, project.uuid, { name: 'Taken' })).name).toBe('Taken');
  });

  it('answers PROJECT_NAME_TAKEN when a rename race is lost on the unique index', async () => {
    await seedProject(harness.ds, userId, { name: 'Taken' });
    const project = await seedProject(harness.ds, userId, { name: 'mine' });
    const spy = jest.spyOn(harness.get(ProjectStore), 'findLiveByName').mockResolvedValueOnce(null);

    await expect(service.edit(userId, project.uuid, { name: 'taken' })).rejects.toMatchObject({
      response: { code: ErrorCodes.PROJECT_NAME_TAKEN },
    });
    spy.mockRestore();
  });

  it('rethrows an unexpected write failure', async () => {
    const project = await seedProject(harness.ds, userId, { name: 'p' });
    const failure = new Error('boom');
    const spy = jest.spyOn(harness.get(ProjectStore), 'update').mockRejectedValueOnce(failure);

    await expect(service.edit(userId, project.uuid, { name: 'q' })).rejects.toBe(failure);
    spy.mockRestore();
  });

  it('answers the project 404 when the project was deleted between the lookup and the write', async () => {
    const project = await seedProject(harness.ds, userId, { name: 'p' });
    const store = harness.get(ProjectStore);
    const update = store.update.bind(store);
    const spy = jest.spyOn(store, 'update').mockImplementationOnce(async (id, changes, at) => {
      await harness.ds.getRepository(IssuesProject).update({ id }, { deletedAt: SEED_TIME, deletedToken: id });

      return update(id, changes, at);
    });

    await expect(service.edit(userId, project.uuid, { name: 'q' })).rejects.toBeInstanceOf(NotFoundException);
    spy.mockRestore();
  });

  it('keeps the count and the repository summary in the answer', async () => {
    harness.repositories.seed(userId, { repositoryId: 703, githubId: 73, owner: 'o', name: 'three' });
    const project = await seedProject(harness.ds, userId, { name: 'p', repositoryId: 703 });
    await seedIssue(harness.ds, project.id);

    expect(await service.edit(userId, project.uuid, { name: 'q' })).toMatchObject({
      openIssueCount: 1,
      repository: { fullName: 'o/three' },
    });
  });

  it('answers the same 404 for a foreign, a deleted and a missing project, and touches no foreign row', async () => {
    const intruder = await seedIntruder(harness.ds);
    const deleted = await seedProject(harness.ds, userId, { deleted: true });

    for (const uuid of [intruder.projectUuid, deleted.uuid, '00000000-0000-4000-8000-000000000000']) {
      await expect(service.edit(userId, uuid, { name: 'hijack' })).rejects.toBeInstanceOf(NotFoundException);
    }

    expect((await stored(intruder.projectId)).name).toBe('intruder project');
  });
});
