import { ConflictException, NotFoundException } from '@nestjs/common';
import { ErrorCodes } from '../../core/error-codes.js';
import { seedUser } from '../../repositories/tests/support/two-user-baseline.js';
import { IssuesProject } from '../entities/issues-project.entity.js';
import { ProjectStore } from '../project-store.js';
import { ProjectsService } from '../projects.service.js';
import type { ProjectCreationInput } from '../types/projects-api.types.js';
import { buildIssuesDbHarness, HARNESS_START, type IssuesDbHarness } from './support/issues-db-harness.js';
import { seedIssue, seedProject } from './support/issues-seeds.js';

const REPO_ID = 501;

function explicit(name: string, extra: Partial<ProjectCreationInput> = {}): ProjectCreationInput {
  return { name, description: null, repository: null, ...extra };
}

function shortcut(ref: { githubId: number } | { fullName: string }, extra: Partial<ProjectCreationInput> = {}): ProjectCreationInput {
  return { description: null, repository: ref, ...extra };
}

describe('ProjectsService#create (real MySQL)', () => {
  let harness: IssuesDbHarness;
  let service: ProjectsService;
  let userId: number;
  let otherId: number;

  beforeAll(async () => {
    harness = await buildIssuesDbHarness({ KERGHAN_ISSUES_MAX_PROJECTS_PER_USER: '3' });
    service = harness.get(ProjectsService);
  });

  afterAll(() => harness.close());

  beforeEach(async () => {
    userId = await seedUser(harness.ds, 'owner');
    otherId = await seedUser(harness.ds, 'other');
    harness.repositories.seed(userId, { repositoryId: REPO_ID, githubId: 11, owner: 'Darth', name: 'Kerghan' });
    harness.repositories.seed(userId, { repositoryId: REPO_ID + 1, githubId: 12, owner: 'darth', name: 'second' });
    harness.repositories.seed(userId, { repositoryId: REPO_ID + 2, githubId: 13, owner: 'darth', name: 'draft', added: false });
    harness.repositories.seed(otherId, { repositoryId: REPO_ID + 3, githubId: 14, owner: 'someone', name: 'else' });
  });

  async function refusal<T extends Error = ConflictException>(promise: Promise<unknown>): Promise<T> {
    return promise.then(
      () => { throw new Error('expected a rejection'); },
      (error: unknown) => error as T,
    );
  }

  async function rows(): Promise<IssuesProject[]> {
    return harness.ds.getRepository(IssuesProject).findBy({ userId });
  }

  describe('explicit', () => {
    it('creates a non-code project with 201, a zero count and a stored row', async () => {
      const result = await service.create(userId, explicit('Roadmap', { description: 'notes' }), 'explicit');

      expect(result.status).toBe(201);
      expect(result.project).toEqual({
        id: expect.stringMatching(/^[0-9a-f-]{36}$/),
        name: 'Roadmap',
        description: 'notes',
        repository: null,
        openIssueCount: 0,
        createdAt: HARNESS_START.toISOString(),
        updatedAt: HARNESS_START.toISOString(),
      });
      expect(await rows()).toEqual([
        expect.objectContaining({ uuid: result.project.id, userId, name: 'Roadmap', repositoryId: null, deletedToken: 0 }),
      ]);
    });

    it('creates a project on one of the caller\'s added repositories, with its summary', async () => {
      const result = await service.create(userId, explicit('Code', { repository: { githubId: 11 } }), 'explicit');

      expect(result.status).toBe(201);
      expect(result.project.repository).toEqual({
        githubId: 11, owner: 'Darth', name: 'Kerghan', fullName: 'Darth/Kerghan', private: false, status: 'added',
      });
      expect((await rows())[0].repositoryId).toBe(REPO_ID);
    });

    it('answers the Add 404 for a missing ref and for another user\'s row, and stores nothing', async () => {
      const missing = await refusal<NotFoundException>(service.create(userId, explicit('A', { repository: { githubId: 999 } }), 'explicit'));
      const foreign = await refusal<NotFoundException>(service.create(userId, explicit('A', { repository: { githubId: 14 } }), 'explicit'));

      expect(missing).toBeInstanceOf(NotFoundException);
      expect(missing.getResponse()).toEqual(foreign.getResponse());
      expect(missing.message).toBe('Repository not found');
      expect(await rows()).toEqual([]);
    });

    it('refuses a not-added repository with PROJECT_REPOSITORY_NOT_ADDED', async () => {
      const error = await refusal(service.create(userId, explicit('A', { repository: { githubId: 13 } }), 'explicit'));

      expect(error.getResponse()).toEqual({ code: ErrorCodes.PROJECT_REPOSITORY_NOT_ADDED, message: 'Add this repository first' });
      expect(await rows()).toEqual([]);
    });

    it('refuses a repository that already has a project with PROJECT_REPOSITORY_TAKEN and meta.projectId', async () => {
      const first = await service.create(userId, explicit('One', { repository: { githubId: 11 } }), 'explicit');
      const error = await refusal(service.create(userId, explicit('Two', { repository: { fullName: 'DARTH/kerghan' } }), 'explicit'));

      expect(error.getResponse()).toEqual({
        code: ErrorCodes.PROJECT_REPOSITORY_TAKEN,
        message: 'This repository already has a project',
        meta: { projectId: first.project.id },
      });
      expect(await rows()).toHaveLength(1);
    });

    it('refuses a taken name, compared case-insensitively, with PROJECT_NAME_TAKEN', async () => {
      await service.create(userId, explicit('Roadmap'), 'explicit');
      const error = await refusal(service.create(userId, explicit('ROADMAP'), 'explicit'));

      expect(error.getResponse()).toEqual({ code: ErrorCodes.PROJECT_NAME_TAKEN, message: 'A project with this name already exists' });
    });

    it('lets another user use the same name', async () => {
      await service.create(userId, explicit('Roadmap'), 'explicit');

      await expect(service.create(otherId, explicit('Roadmap'), 'explicit')).resolves.toMatchObject({ status: 201 });
    });

    it('checks the repository before the name', async () => {
      await service.create(userId, explicit('Roadmap'), 'explicit');
      const error = await refusal(service.create(userId, explicit('Roadmap', { repository: { githubId: 13 } }), 'explicit'));

      expect((error.getResponse() as { code: string }).code).toBe(ErrorCodes.PROJECT_REPOSITORY_NOT_ADDED);
    });

    it('does not look at the repositories for a non-code project', async () => {
      const before = harness.repositories.callsOf('resolveForProject');

      await service.create(userId, explicit('Roadmap'), 'explicit');

      expect(harness.repositories.callsOf('resolveForProject')).toBe(before);
    });
  });

  describe('shortcut', () => {
    it('creates with 201 and the default name owner/name, from the latest snapshot', async () => {
      const result = await service.create(userId, shortcut({ githubId: 11 }), 'shortcut');

      expect(result.status).toBe(201);
      expect(result.project).toMatchObject({ name: 'Darth/Kerghan', openIssueCount: 0, repository: { githubId: 11 } });
    });

    it('uses the given name and description', async () => {
      const result = await service.create(userId, shortcut({ githubId: 11 }, { name: 'Mine', description: 'd' }), 'shortcut');

      expect(result.project).toMatchObject({ name: 'Mine', description: 'd' });
    });

    it('returns the existing project with 200, ignoring name and description, with its open-issue count', async () => {
      const first = await service.create(userId, shortcut({ githubId: 11 }), 'shortcut');
      const stored = (await rows())[0];

      await seedIssue(harness.ds, stored.id, { state: 'open' });
      await seedIssue(harness.ds, stored.id, { state: 'open' });
      await seedIssue(harness.ds, stored.id, { state: 'closed' });

      const again = await service.create(userId, shortcut({ fullName: 'darth/kerghan' }, { name: 'Other', description: 'x' }), 'shortcut');

      expect(again.status).toBe(200);
      expect(again.project).toEqual({ ...first.project, openIssueCount: 2 });
      expect(await rows()).toHaveLength(1);
    });

    it('refuses a not-added repository and never adds one', async () => {
      const error = await refusal(service.create(userId, shortcut({ githubId: 13 }), 'shortcut'));

      expect((error.getResponse() as { code: string }).code).toBe(ErrorCodes.PROJECT_REPOSITORY_NOT_ADDED);
      expect(await rows()).toEqual([]);
    });

    it('answers the Add 404 for another user\'s repository', async () => {
      await expect(service.create(userId, shortcut({ githubId: 14 }), 'shortcut')).rejects.toBeInstanceOf(NotFoundException);
    });

    it('answers PROJECT_NAME_TAKEN on a collision, without a suffix', async () => {
      await service.create(userId, explicit('Darth/Kerghan'), 'explicit');
      const error = await refusal(service.create(userId, shortcut({ githubId: 11 }), 'shortcut'));

      expect((error.getResponse() as { code: string }).code).toBe(ErrorCodes.PROJECT_NAME_TAKEN);
    });

    it('cuts a default name over 100 code points to 100', async () => {
      harness.repositories.seed(userId, { repositoryId: 900, githubId: 90, owner: 'o'.repeat(39), name: '😀'.repeat(100) });

      const result = await service.create(userId, shortcut({ githubId: 90 }), 'shortcut');

      expect([...result.project.name]).toHaveLength(100);
      expect(result.project.name.startsWith(`${'o'.repeat(39)}/`)).toBe(true);
    });
  });

  describe('the live-project cap (3 here)', () => {
    it('allows up to the cap and refuses the next with PROJECTS_LIMIT_REACHED', async () => {
      for (const name of ['a', 'b', 'c']) await service.create(userId, explicit(name), 'explicit');

      const error = await refusal(service.create(userId, explicit('d'), 'explicit'));

      expect(error.getResponse()).toEqual({
        code: ErrorCodes.PROJECTS_LIMIT_REACHED,
        message: 'You reached the maximum number of projects',
      });
      expect(await rows()).toHaveLength(3);
    });

    it('never refuses the shortcut\'s existing-project 200, even at the cap', async () => {
      await service.create(userId, shortcut({ githubId: 11 }), 'shortcut');
      await service.create(userId, explicit('b'), 'explicit');
      await service.create(userId, explicit('c'), 'explicit');

      await expect(service.create(userId, shortcut({ githubId: 11 }), 'shortcut')).resolves.toMatchObject({ status: 200 });
      await expect(service.create(userId, shortcut({ githubId: 12 }), 'shortcut')).rejects.toMatchObject({
        response: { code: ErrorCodes.PROJECTS_LIMIT_REACHED },
      });
    });

    it('does not count tombstones, nor another user\'s projects', async () => {
      await seedProject(harness.ds, userId, { deleted: true });
      await seedProject(harness.ds, userId, { deleted: true });
      await seedProject(harness.ds, otherId);
      await seedProject(harness.ds, otherId);
      await seedProject(harness.ds, otherId);

      for (const name of ['a', 'b', 'c']) {
        await expect(service.create(userId, explicit(name), 'explicit')).resolves.toMatchObject({ status: 201 });
      }
    });
  });

  describe('reuse after deletion', () => {
    it('lets a name and a repository be reused once the project is a tombstone', async () => {
      const gone = await seedProject(harness.ds, userId, { name: 'Roadmap', repositoryId: REPO_ID, deleted: true });

      const result = await service.create(userId, explicit('Roadmap', { repository: { githubId: 11 } }), 'explicit');

      expect(result.status).toBe(201);
      expect(result.project.id).not.toBe(gone.uuid);
    });
  });

  describe('lost races (decided by the unique indexes)', () => {
    it('answers PROJECT_NAME_TAKEN when another creation wins the name between the check and the insert', async () => {
      await service.create(userId, explicit('Roadmap'), 'explicit');
      const spy = jest.spyOn(harness.get(ProjectStore), 'findLiveByName').mockResolvedValueOnce(null);

      const error = await refusal(service.create(userId, explicit('roadmap'), 'explicit'));

      expect((error.getResponse() as { code: string }).code).toBe(ErrorCodes.PROJECT_NAME_TAKEN);
      spy.mockRestore();
    });

    it('answers PROJECT_REPOSITORY_TAKEN with the winner on the explicit path', async () => {
      const winner = await service.create(userId, explicit('One', { repository: { githubId: 11 } }), 'explicit');
      const spy = jest.spyOn(harness.get(ProjectStore), 'findLiveByRepository').mockResolvedValueOnce(null);

      const error = await refusal(service.create(userId, explicit('Two', { repository: { githubId: 11 } }), 'explicit'));

      expect(error.getResponse()).toMatchObject({ code: ErrorCodes.PROJECT_REPOSITORY_TAKEN, meta: { projectId: winner.project.id } });
      spy.mockRestore();
    });

    it('re-reads the winner and answers 200 on the shortcut', async () => {
      const winner = await service.create(userId, shortcut({ githubId: 11 }), 'shortcut');
      const spy = jest.spyOn(harness.get(ProjectStore), 'findLiveByRepository').mockResolvedValueOnce(null);

      const result = await service.create(userId, shortcut({ githubId: 11 }, { name: 'ignored' }), 'shortcut');

      expect(result).toEqual({ status: 200, project: winner.project });
      spy.mockRestore();
    });

    it('rethrows an error that is not a known unique violation', async () => {
      const failure = new Error('boom');
      const spy = jest.spyOn(harness.get(ProjectStore), 'insert').mockRejectedValueOnce(failure);

      await expect(service.create(userId, explicit('x'), 'explicit')).rejects.toBe(failure);
      spy.mockRestore();
    });
  });

  it('answers the project 404 when the session\'s user no longer exists, and stores nothing', async () => {
    const ghost = otherId + 1000;

    await expect(service.create(ghost, explicit('x'), 'explicit')).rejects.toBeInstanceOf(NotFoundException);
    expect(await harness.ds.getRepository(IssuesProject).countBy({ userId: ghost })).toBe(0);
  });

  it('refuses an input with neither a name nor a repository (a programming error, not reachable from the DTOs)', async () => {
    await expect(service.create(userId, { description: null, repository: null }, 'explicit')).rejects.toThrow(/needs a name/);
  });
});
