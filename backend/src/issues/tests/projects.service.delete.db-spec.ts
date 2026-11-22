import { NotFoundException } from '@nestjs/common';
import { seedUser } from '../../repositories/tests/support/two-user-baseline.js';
import { IssueGithubLink } from '../entities/issue-github-link.entity.js';
import { IssuePendingWrite } from '../entities/issue-pending-write.entity.js';
import { Issue } from '../entities/issue.entity.js';
import { IssuesProject } from '../entities/issues-project.entity.js';
import { ProjectStore } from '../project-store.js';
import { ProjectsService } from '../projects.service.js';
import { buildIssuesDbHarness, HARNESS_START, type IssuesDbHarness } from './support/issues-db-harness.js';
import { seedIssue, seedLink, seedMarker, seedProject } from './support/issues-seeds.js';

describe('ProjectsService#delete (real MySQL)', () => {
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

  const count = (entity: new () => object, where: object): Promise<number> => harness.ds.getRepository(entity).countBy(where);

  /** A project with a plain issue, a linked issue and a linked issue with a marker (x2). */
  async function fullProject(repositoryId: number | null = null): Promise<{ id: number; uuid: string; issueIds: number[]; linkIds: number[] }> {
    const project = await seedProject(harness.ds, userId, { name: 'Full', description: 'bye', repositoryId });
    const plain = await seedIssue(harness.ds, project.id);
    const linked = await seedIssue(harness.ds, project.id);
    const unsentA = await seedIssue(harness.ds, project.id);
    const unsentB = await seedIssue(harness.ds, project.id);
    const linkIds: number[] = [];

    for (const issue of [linked, unsentA, unsentB]) linkIds.push((await seedLink(harness.ds, { userId, issueId: issue.id })).id);

    await seedMarker(harness.ds, linkIds[1]);
    await seedMarker(harness.ds, linkIds[2]);

    return { ...project, issueIds: [plain.id, linked.id, unsentA.id, unsentB.id], linkIds };
  }

  it('hard-deletes the markers, links and issues, and reports the unsent count counted before the delete', async () => {
    const project = await fullProject();

    expect(await service.delete(userId, project.uuid)).toEqual({ unsentIssueCount: 2 });

    expect(await count(Issue, { projectId: project.id })).toBe(0);
    expect(await harness.ds.query('SELECT id FROM issues_github_links WHERE id IN (?)', [project.linkIds])).toEqual([]);
    expect(await harness.ds.query('SELECT id FROM issues_pending_writes WHERE link_id IN (?)', [project.linkIds])).toEqual([]);
  });

  it('keeps a tombstone: description cleared, deleted_at and deleted_token written together', async () => {
    const project = await fullProject();

    await service.delete(userId, project.uuid);

    expect(await harness.ds.getRepository(IssuesProject).findOneByOrFail({ id: project.id })).toMatchObject({
      name: 'Full',
      description: null,
      deletedAt: new Date('2026-06-01T13:00:00Z'),
      deletedToken: project.id,
    });
  });

  it('answers 0 for a project without issues', async () => {
    const project = await seedProject(harness.ds, userId);

    expect(await service.delete(userId, project.uuid)).toEqual({ unsentIssueCount: 0 });
  });

  it('counts an issue once however its marker is stored, and ignores linked issues without a marker', async () => {
    const project = await seedProject(harness.ds, userId);
    const issue = await seedIssue(harness.ds, project.id);
    const link = await seedLink(harness.ds, { userId, issueId: issue.id });
    await seedMarker(harness.ds, link.id);
    const other = await seedIssue(harness.ds, project.id);
    await seedLink(harness.ds, { userId, issueId: other.id });

    expect(await service.delete(userId, project.uuid)).toEqual({ unsentIssueCount: 1 });
  });

  it('answers the 404 on a second delete and on any route on the deleted project', async () => {
    const project = await seedProject(harness.ds, userId);

    await service.delete(userId, project.uuid);

    await expect(service.delete(userId, project.uuid)).rejects.toBeInstanceOf(NotFoundException);
    await expect(service.show(userId, project.uuid)).rejects.toBeInstanceOf(NotFoundException);
    await expect(service.edit(userId, project.uuid, { name: 'x' })).rejects.toBeInstanceOf(NotFoundException);
    await expect(service.setRepository(userId, project.uuid, { repository: null })).rejects.toBeInstanceOf(NotFoundException);
  });

  it('frees the name and the repository for a new project', async () => {
    harness.repositories.seed(userId, { repositoryId: 810, githubId: 91, owner: 'o', name: 'r' });
    const project = await fullProject(810);

    await service.delete(userId, project.uuid);

    const created = await service.create(userId, { name: 'Full', description: null, repository: { githubId: 91 } }, 'explicit');

    expect(created.status).toBe(201);
    expect(created.project.id).not.toBe(project.uuid);
  });

  it('leaves every other project, issue, link and marker of the user and of others untouched', async () => {
    const { intruder } = harness;
    const survivor = await fullProject();
    const target = await seedProject(harness.ds, userId, { name: 'Target' });
    await seedIssue(harness.ds, target.id);

    await service.delete(userId, target.uuid);

    expect(await count(Issue, { projectId: survivor.id })).toBe(4);
    expect(await count(IssueGithubLink, { userId })).toBe(3);
    expect(await count(IssuePendingWrite, {})).toBe(3);
    expect(await count(Issue, { projectId: intruder.projectId })).toBe(1);
    expect(await count(IssueGithubLink, { id: intruder.linkId })).toBe(1);
    expect(await count(IssuePendingWrite, { id: intruder.markerId })).toBe(1);
    expect(await count(IssuesProject, { id: intruder.projectId, deletedToken: 0 })).toBe(1);
  });

  it('answers the same 404 for a foreign project and touches none of its rows', async () => {
    const { intruder } = harness;

    await expect(service.delete(userId, intruder.projectUuid)).rejects.toBeInstanceOf(NotFoundException);

    expect(await count(Issue, { projectId: intruder.projectId })).toBe(1);
    expect(await count(IssuesProject, { id: intruder.projectId, deletedToken: 0 })).toBe(1);
  });

  it('rolls everything back when the tombstone write finds no live row', async () => {
    const project = await fullProject();
    const spy = jest.spyOn(harness.get(ProjectStore), 'markDeleted').mockResolvedValueOnce(false);

    await expect(service.delete(userId, project.uuid)).rejects.toBeInstanceOf(NotFoundException);

    expect(await count(Issue, { projectId: project.id })).toBe(4);
    expect(await count(IssuePendingWrite, {})).toBe(3); // the project's two markers and the intruder's
    spy.mockRestore();
  });
});
