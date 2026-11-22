import { NotFoundException } from '@nestjs/common';
import { seedUser } from '../../repositories/tests/support/two-user-baseline.js';
import { IssuesService } from '../issues.service.js';
import { buildIssuesDbHarness, type IssuesDbHarness } from './support/issues-db-harness.js';
import { seedIssue, seedLink, seedMarker, seedProject, type SeededProject } from './support/issues-seeds.js';

describe('IssuesService#delete (real MySQL)', () => {
  let harness: IssuesDbHarness;
  let service: IssuesService;
  let userId: number;
  let project: SeededProject;

  beforeAll(async () => {
    harness = await buildIssuesDbHarness();
    service = harness.get(IssuesService);
  });

  afterAll(() => harness.close());

  beforeEach(async () => {
    userId = await seedUser(harness.ds, 'owner');
    project = await seedProject(harness.ds, userId);
  });

  const issueCount = async (id?: number): Promise<number> => {
    const rows: Array<{ total: string }> = await harness.ds.query(
      `SELECT COUNT(*) AS total FROM issues${id === undefined ? '' : ' WHERE id = ?'}`,
      id === undefined ? [] : [id],
    );

    return Number(rows[0].total);
  };

  it('hard-deletes an unlinked issue and answers {}', async () => {
    const issue = await seedIssue(harness.ds, project.id);
    const keep = await seedIssue(harness.ds, project.id);

    expect(await service.delete(userId, project.uuid, issue.uuid)).toEqual({});
    expect(await issueCount(issue.id)).toBe(0);
    expect(await issueCount(keep.id)).toBe(1);
  });

  it('answers 404 on a second delete', async () => {
    const issue = await seedIssue(harness.ds, project.id);

    await service.delete(userId, project.uuid, issue.uuid);

    await expect(service.delete(userId, project.uuid, issue.uuid)).rejects.toBeInstanceOf(NotFoundException);
  });

  it.each(['linked', 'sync_failed', 'gone'])('answers 409 ISSUE_LINKED for a %s link and keeps the issue, link and marker', async (status) => {
    const issue = await seedIssue(harness.ds, project.id);
    const link = await seedLink(harness.ds, { userId, issueId: issue.id, status, statusReason: status === 'gone' ? 'deleted' : null });
    await seedMarker(harness.ds, link.id);

    await expect(service.delete(userId, project.uuid, issue.uuid)).rejects.toMatchObject({
      response: { code: 'ISSUE_LINKED', message: 'Unlink this issue before deleting it' },
    });
    expect(await issueCount(issue.id)).toBe(1);
    expect(await harness.ds.query('SELECT id FROM issues_github_links WHERE id = ?', [link.id])).toHaveLength(1);
    expect(await harness.ds.query('SELECT id FROM issues_pending_writes WHERE link_id = ?', [link.id])).toHaveLength(1);
  });

  it('answers 404 for the intruder\'s project and issue, leaving his rows untouched', async () => {
    const { intruder } = harness;
    const mine = await seedIssue(harness.ds, project.id);

    await expect(service.delete(userId, intruder.projectUuid, intruder.issueUuid)).rejects.toBeInstanceOf(NotFoundException);
    await expect(service.delete(userId, project.uuid, intruder.issueUuid)).rejects.toBeInstanceOf(NotFoundException);
    expect(await issueCount(intruder.issueId)).toBe(1);
    expect(await issueCount(mine.id)).toBe(1);
    expect(await harness.ds.query('SELECT id FROM issues_pending_writes WHERE id = ?', [intruder.markerId])).toHaveLength(1);
  });
});
