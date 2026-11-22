import { ConflictException, NotFoundException } from '@nestjs/common';
import { ErrorCodes } from '../../core/error-codes.js';
import { seedUser } from '../../repositories/tests/support/two-user-baseline.js';
import { IssuesProject } from '../entities/issues-project.entity.js';
import { ProjectStore } from '../project-store.js';
import { ProjectsService } from '../projects.service.js';
import { buildIssuesDbHarness, HARNESS_START, type IssuesDbHarness } from './support/issues-db-harness.js';
import { seedIssue, seedLink, seedProject, SEED_TIME } from './support/issues-seeds.js';

const REPO_A = 801;
const REPO_B = 802;

describe('ProjectsService#setRepository (real MySQL)', () => {
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
    harness.repositories.seed(userId, { repositoryId: REPO_A, githubId: 81, owner: 'o', name: 'a' });
    harness.repositories.seed(userId, { repositoryId: REPO_B, githubId: 82, owner: 'o', name: 'b' });
    harness.repositories.seed(userId, { repositoryId: 803, githubId: 83, owner: 'o', name: 'draft', added: false });
  });

  const stored = (id: number): Promise<IssuesProject> => harness.ds.getRepository(IssuesProject).findOneByOrFail({ id });

  async function refusal(promise: Promise<unknown>): Promise<ConflictException> {
    return promise.then(
      () => { throw new Error('expected a rejection'); },
      (error: unknown) => error as ConflictException,
    );
  }

  /** A project on `repositoryId` with `links` linked issues. */
  async function linkedProject(repositoryId: number | null, links: number): Promise<{ id: number; uuid: string }> {
    const project = await seedProject(harness.ds, userId, { repositoryId });

    for (let index = 0; index < links; index += 1) {
      const issue = await seedIssue(harness.ds, project.id);

      await seedLink(harness.ds, { userId, issueId: issue.id });
    }

    return project;
  }

  describe('without links', () => {
    it('attaches a repository to a project without one, with the summary, and bumps updated_at', async () => {
      const project = await seedProject(harness.ds, userId);

      const result = await service.setRepository(userId, project.uuid, { repository: { githubId: 81 } });

      expect(result).toMatchObject({ repository: { githubId: 81, fullName: 'o/a', status: 'added' }, updatedAt: '2026-06-01T13:00:00.000Z' });
      expect(await stored(project.id)).toMatchObject({ repositoryId: REPO_A, updatedAt: new Date('2026-06-01T13:00:00Z') });
    });

    it('changes the repository', async () => {
      const project = await seedProject(harness.ds, userId, { repositoryId: REPO_A });

      const result = await service.setRepository(userId, project.uuid, { repository: { fullName: 'O/B' } });

      expect(result.repository?.fullName).toBe('o/b');
      expect((await stored(project.id)).repositoryId).toBe(REPO_B);
    });

    it('detaches the repository', async () => {
      const project = await seedProject(harness.ds, userId, { repositoryId: REPO_A });

      expect((await service.setRepository(userId, project.uuid, { repository: null })).repository).toBeNull();
      expect((await stored(project.id)).repositoryId).toBeNull();
    });

    it('answers the open-issue count and never syncs or calls anything else', async () => {
      const project = await seedProject(harness.ds, userId, { repositoryId: REPO_A });
      await seedIssue(harness.ds, project.id);

      expect((await service.setRepository(userId, project.uuid, { repository: { githubId: 82 } })).openIssueCount).toBe(1);
    });
  });

  it('E28: a repository turning private or public changes nothing in Kerghan, and the project stays owner-only', async () => {
    const project = await seedProject(harness.ds, userId, { repositoryId: REPO_A });
    const stored0 = await stored(project.id);
    const publicView = await service.show(userId, project.uuid);

    harness.repositories.seed(userId, { repositoryId: REPO_A, githubId: 81, owner: 'o', name: 'a', private: true });

    const privateView = await service.show(userId, project.uuid);

    expect(await stored(project.id)).toEqual(stored0);
    expect(privateView).toEqual({ ...publicView, repository: { ...publicView.repository, private: true } });
    await expect(service.show(harness.intruder.userId, project.uuid)).rejects.toBeInstanceOf(NotFoundException);
  });

  describe('with links (E62)', () => {
    it.each([
      ['change', { repository: { githubId: 82 } }],
      ['detach', { repository: null }],
    ])('refuses a %s with PROJECT_HAS_LINKS and the link count, and changes nothing', async (_label, input) => {
      const project = await linkedProject(REPO_A, 2);

      const error = await refusal(service.setRepository(userId, project.uuid, input));

      expect(error.getResponse()).toEqual({
        code: ErrorCodes.PROJECT_HAS_LINKS,
        message: "Unlink the project's issues before changing its repository",
        meta: { linkCount: 2 },
      });
      expect(await stored(project.id)).toMatchObject({ repositoryId: REPO_A, updatedAt: SEED_TIME });
    });

    it('counts only the project\'s own links', async () => {
      await linkedProject(REPO_B, 3);
      const project = await linkedProject(REPO_A, 1);

      const error = await refusal(service.setRepository(userId, project.uuid, { repository: null }));

      expect(error.getResponse()).toMatchObject({ meta: { linkCount: 1 } });
    });

    it('succeeds once the links are gone', async () => {
      const project = await linkedProject(REPO_A, 1);
      await harness.ds.query('DELETE FROM issues_github_links');

      await expect(service.setRepository(userId, project.uuid, { repository: null })).resolves.toMatchObject({ repository: null });
    });

    it('is a no-op 200 for the same repository, links or not, with no write', async () => {
      const project = await linkedProject(REPO_A, 2);
      const spy = jest.spyOn(harness.get(ProjectStore), 'update');

      const result = await service.setRepository(userId, project.uuid, { repository: { githubId: 81 } });

      expect(result).toMatchObject({ repository: { githubId: 81 }, updatedAt: SEED_TIME.toISOString() });
      expect(spy).not.toHaveBeenCalled();
      spy.mockRestore();
    });

    it('is a no-op 200 to detach a project without a repository', async () => {
      const project = await seedProject(harness.ds, userId);
      const spy = jest.spyOn(harness.get(ProjectStore), 'update');

      expect((await service.setRepository(userId, project.uuid, { repository: null })).repository).toBeNull();
      expect(spy).not.toHaveBeenCalled();
      spy.mockRestore();
    });

    it('lets a project without a repository attach one even with issues linked', async () => {
      const project = await linkedProject(null, 1);

      await expect(service.setRepository(userId, project.uuid, { repository: { githubId: 81 } })).resolves.toMatchObject({
        repository: { githubId: 81 },
      });
    });
  });

  describe('the creation checks', () => {
    it('answers the Add 404 for a missing ref and another user\'s row', async () => {
      const { intruder } = harness;
      harness.repositories.seed(intruder.userId, { repositoryId: 899, githubId: 89 });
      const project = await seedProject(harness.ds, userId);

      for (const ref of [{ githubId: 999 }, { githubId: 89 }]) {
        await expect(service.setRepository(userId, project.uuid, { repository: ref })).rejects.toMatchObject({
          message: 'Repository not found',
        });
      }

      expect((await stored(project.id)).repositoryId).toBeNull();
    });

    it('refuses a not-added repository with PROJECT_REPOSITORY_NOT_ADDED', async () => {
      const project = await seedProject(harness.ds, userId);

      const error = await refusal(service.setRepository(userId, project.uuid, { repository: { githubId: 83 } }));

      expect(error.getResponse()).toEqual({ code: ErrorCodes.PROJECT_REPOSITORY_NOT_ADDED, message: 'Add this repository first' });
    });

    it('refuses a repository that already has another live project, with meta.projectId', async () => {
      const holder = await seedProject(harness.ds, userId, { repositoryId: REPO_B });
      const project = await seedProject(harness.ds, userId);

      const error = await refusal(service.setRepository(userId, project.uuid, { repository: { githubId: 82 } }));

      expect(error.getResponse()).toEqual({
        code: ErrorCodes.PROJECT_REPOSITORY_TAKEN,
        message: 'This repository already has a project',
        meta: { projectId: holder.uuid },
      });
      expect((await stored(project.id)).repositoryId).toBeNull();
    });

    it('attaches a repository once its other project was deleted', async () => {
      await seedProject(harness.ds, userId, { repositoryId: REPO_B, deleted: true });
      const project = await seedProject(harness.ds, userId);

      await expect(service.setRepository(userId, project.uuid, { repository: { githubId: 82 } })).resolves.toMatchObject({
        repository: { githubId: 82 },
      });
    });

    it('answers the project 404 first, whatever the ref, for a foreign, deleted or missing project', async () => {
      const { intruder } = harness;
      const deleted = await seedProject(harness.ds, userId, { deleted: true });

      for (const uuid of [intruder.projectUuid, deleted.uuid, '00000000-0000-4000-8000-000000000000']) {
        for (const ref of [{ githubId: 81 }, { githubId: 999 }, { githubId: 83 }, null]) {
          await expect(service.setRepository(userId, uuid, { repository: ref })).rejects.toMatchObject({ message: 'Project not found' });
        }
      }

      expect((await stored(intruder.projectId)).repositoryId).toBeNull();
    });
  });

  describe('races', () => {
    it('E48: answers PROJECT_REPOSITORY_TAKEN with the winner when the unique index decides', async () => {
      const winner = await seedProject(harness.ds, userId, { repositoryId: REPO_B });
      const project = await seedProject(harness.ds, userId);
      const spy = jest.spyOn(harness.get(ProjectStore), 'findLiveByRepository').mockResolvedValueOnce(null);

      const error = await refusal(service.setRepository(userId, project.uuid, { repository: { githubId: 82 } }));

      expect(error.getResponse()).toMatchObject({ code: ErrorCodes.PROJECT_REPOSITORY_TAKEN, meta: { projectId: winner.uuid } });
      spy.mockRestore();
    });

    it('rethrows an unexpected write failure', async () => {
      const project = await seedProject(harness.ds, userId);
      const failure = new Error('boom');
      const spy = jest.spyOn(harness.get(ProjectStore), 'update').mockRejectedValueOnce(failure);

      await expect(service.setRepository(userId, project.uuid, { repository: { githubId: 81 } })).rejects.toBe(failure);
      spy.mockRestore();
    });

    it('answers the project 404 when the project was deleted after the lock check', async () => {
      const project = await seedProject(harness.ds, userId);
      const spy = jest.spyOn(harness.get(ProjectStore), 'update').mockResolvedValueOnce(false);

      await expect(service.setRepository(userId, project.uuid, { repository: { githubId: 81 } })).rejects.toBeInstanceOf(NotFoundException);
      spy.mockRestore();
    });
  });
});
