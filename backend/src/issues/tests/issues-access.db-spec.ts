import { NotFoundException } from '@nestjs/common';
import { DataSource } from 'typeorm';
import { IssuesAccess } from '../issues-access.js';
import { buildIssuesDbHarness, type IssuesDbHarness } from './support/issues-db-harness.js';
import { seedIntruder, seedIssue, seedProject } from './support/issues-seeds.js';
import { seedUser } from '../../repositories/tests/support/two-user-baseline.js';

describe('IssuesAccess (real MySQL)', () => {
  let harness: IssuesDbHarness;
  let access: IssuesAccess;

  beforeAll(async () => {
    harness = await buildIssuesDbHarness();
    access = harness.get(IssuesAccess);
  });

  afterAll(() => harness.close());

  async function caught(promise: Promise<unknown>): Promise<NotFoundException> {
    return promise.then(
      () => { throw new Error('expected a rejection'); },
      (error: unknown) => error as NotFoundException,
    );
  }

  it('resolves the owner\'s live project', async () => {
    const userId = await seedUser(harness.ds, 'owner');
    const project = await seedProject(harness.ds, userId);

    await expect(access.findLiveProject(userId, project.uuid)).resolves.toMatchObject({ id: project.id, userId });
  });

  it('answers the identical 404 Project not found for a missing, a foreign and a soft-deleted project', async () => {
    const userId = await seedUser(harness.ds, 'owner');
    const intruder = await seedIntruder(harness.ds);
    const deleted = await seedProject(harness.ds, userId, { deleted: true });

    const missing = await caught(access.findLiveProject(userId, '00000000-0000-4000-8000-000000000000'));
    const foreign = await caught(access.findLiveProject(userId, intruder.projectUuid));
    const gone = await caught(access.findLiveProject(userId, deleted.uuid));

    for (const error of [missing, foreign, gone]) {
      expect(error).toBeInstanceOf(NotFoundException);
      expect(error.message).toBe('Project not found');
    }
    expect(JSON.stringify(foreign.getResponse())).toBe(JSON.stringify(missing.getResponse()));
    expect(JSON.stringify(gone.getResponse())).toBe(JSON.stringify(missing.getResponse()));
  });

  it('finds an issue of the project, and answers 404 Issue not found for another project\'s or the intruder\'s', async () => {
    const userId = await seedUser(harness.ds, 'owner');
    const intruder = await seedIntruder(harness.ds);
    const project = await seedProject(harness.ds, userId);
    const other = await seedProject(harness.ds, userId);
    const issue = await seedIssue(harness.ds, project.id);
    const elsewhere = await seedIssue(harness.ds, other.id);
    const resolved = await access.findLiveProject(userId, project.uuid);

    await expect(access.findIssueInProject(resolved, issue.uuid)).resolves.toMatchObject({ id: issue.id });
    for (const uuid of [elsewhere.uuid, intruder.issueUuid, '00000000-0000-4000-8000-000000000000']) {
      const error = await caught(access.findIssueInProject(resolved, uuid));

      expect(error).toBeInstanceOf(NotFoundException);
      expect(error.message).toBe('Issue not found');
    }
  });

  it('runs lock: true inside a transaction, reading through the given manager', async () => {
    const userId = await seedUser(harness.ds, 'owner');
    const project = await seedProject(harness.ds, userId);
    const issue = await seedIssue(harness.ds, project.id);

    await harness.get(DataSource).transaction(async (manager) => {
      const locked = await access.findLiveProject(userId, project.uuid, manager, { lock: true });
      const lockedIssue = await access.findIssueInProject(locked, issue.uuid, manager, { lock: true });

      expect(locked.id).toBe(project.id);
      expect(lockedIssue.id).toBe(issue.id);
    });
  });

  it('refuses lock: true outside a transaction', async () => {
    const userId = await seedUser(harness.ds, 'owner');
    const project = await seedProject(harness.ds, userId);

    await expect(access.findLiveProject(userId, project.uuid, undefined, { lock: true })).rejects.toThrow();
  });
});
