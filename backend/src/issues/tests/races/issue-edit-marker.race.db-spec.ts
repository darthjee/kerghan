import { seedUser } from '../../../repositories/tests/support/two-user-baseline.js';
import { Issue } from '../../entities/issue.entity.js';
import { IssuesService } from '../../issues.service.js';
import { buildIssuesDbHarness, type IssuesDbHarness } from '../support/issues-db-harness.js';
import { seedIssue, seedLink, seedProject } from '../support/issues-seeds.js';

// E42: two simultaneous edits of one linked issue. The issue row lock serializes them, so both
// marker upserts land (`revision = 2`) and the issue row is last-write-wins.
describe('Issue edit marker race (real MySQL)', () => {
  let harness: IssuesDbHarness;
  let service: IssuesService;
  let userId: number;

  beforeAll(async () => {
    harness = await buildIssuesDbHarness();
    service = harness.get(IssuesService);
  });

  afterAll(() => harness.close());

  beforeEach(async () => {
    userId = await seedUser(harness.ds, 'owner');
  });

  it.each([1, 2, 3, 4, 5])('lands both marker bumps and keeps one marker (run %i)', async () => {
    const project = await seedProject(harness.ds, userId);
    const issue = await seedIssue(harness.ds, project.id, { title: 'old' });
    const link = await seedLink(harness.ds, { userId, issueId: issue.id });

    await Promise.all(['a', 'b'].map((title) => service.edit(userId, project.uuid, issue.uuid, { title })));

    const markers: Array<{ link_id: number; revision: number }> = await harness.ds.query(
      'SELECT link_id, revision FROM issues_pending_writes WHERE link_id <> ?',
      [harness.intruder.linkId],
    );
    const row = await harness.ds.getRepository(Issue).findOneByOrFail({ id: issue.id });

    expect(markers).toEqual([{ link_id: link.id, revision: 2 }]);
    expect(['a', 'b']).toContain(row.title);
  });
});
