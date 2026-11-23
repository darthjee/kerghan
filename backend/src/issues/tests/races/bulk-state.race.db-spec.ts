import { NotFoundException } from '@nestjs/common';
import { Issue, type IssueState } from '../../entities/issue.entity.js';
import { IssuesProject } from '../../entities/issues-project.entity.js';
import { IssueStore } from '../../issue-store.js';
import { IssuesService } from '../../issues.service.js';
import { ISSUES_RECONCILE_JOB } from '../../jobs/issues-reconcile.job.js';
import { ProjectsService } from '../../projects.service.js';
import { buildIssuesHttpDbHarness, type IssuesHttpDbHarness } from '../support/issues-http-db-harness.js';
import { seedIssue } from '../support/issues-seeds.js';
import { buildLinkWorld, linkApi, type LinkWorld, rowCount, scriptIssue } from '../support/link-fixture.js';
import { lockWaiterOn, until } from '../support/race-helpers.js';

/** A promise the spec opens by hand, to park a call at a known point. */
function gate(): { opened: Promise<void>; open: () => void } {
  let open = (): void => undefined;
  const opened = new Promise<void>((resolve) => { open = resolve; });

  return { opened, open };
}

// Bulk close/reopen against concurrent writers (`docs/agents/backend/routes/issues/issues.md#bulk-close-and-reopen`): the project
// row lock serializes it with attach and deletion, and the issue locks in id order keep two bulk
// calls from deadlocking.
describe('Bulk state races (real MySQL)', () => {
  let harness: IssuesHttpDbHarness;
  let world: LinkWorld;
  let service: IssuesService;

  beforeAll(async () => {
    harness = await buildIssuesHttpDbHarness({ KERGHAN_ISSUES_LINK_MAX_PER_WINDOW: '1000' });
    service = harness.get(IssuesService);
  });

  afterAll(() => harness.close());

  beforeEach(async () => {
    jest.restoreAllMocks();
    world = await buildLinkWorld(harness);
  });

  const bulk = (issueIds: string[], state: IssueState) => service.bulkState(world.userId, world.project.uuid, { issueIds, state });
  const stateOf = async (id: number): Promise<string> => (await harness.ds.getRepository(Issue).findOneByOrFail({ id })).state;
  const markers = (): Promise<Array<{ link_id: number }>> => harness.ds.query('SELECT link_id FROM issues_pending_writes WHERE link_id <> ?', [harness.intruder.linkId]);

  /** Parks the next bulk call right after it took the project lock, until the gate opens. */
  function parkAfterProjectLock(): { entered: () => boolean; open: () => void } {
    const store = harness.get(IssueStore);
    const original = store.lockManyInProject.bind(store);
    const parked = gate();
    let entered = false;

    jest.spyOn(store, 'lockManyInProject').mockImplementationOnce(async (...args) => {
      entered = true;
      await parked.opened;

      return original(...args);
    });

    return { entered: () => entered, open: parked.open };
  }

  it('E66: sends an id deleted before the issue lock to notFound and applies the others', async () => {
    const [kept, doomed] = [await seedIssue(harness.ds, world.project.id), await seedIssue(harness.ds, world.project.id)];
    let result: Awaited<ReturnType<typeof bulk>> | undefined;
    let pending: Promise<unknown> = Promise.resolve();

    await harness.ds.transaction(async (manager) => {
      await manager.query('DELETE FROM issues WHERE id = ?', [doomed.id]);

      pending = bulk([doomed.uuid, kept.uuid], 'closed').then((value) => { result = value; });

      await until(() => lockWaiterOn(harness.ds, 'issues'), 'the bulk call to wait on the issue lock');
      expect(result).toBeUndefined();
    });

    await pending;

    expect(result).toEqual({ state: 'closed', changed: [kept.uuid], unchanged: [], notFound: [doomed.uuid] });
    expect(await stateOf(kept.id)).toBe('closed');
  });

  it('E67: answers 404 and applies nothing when a project deletion commits first', async () => {
    const issue = await seedIssue(harness.ds, world.project.id);
    let outcome: unknown;
    let pending: Promise<unknown> = Promise.resolve();

    await harness.ds.transaction(async (manager) => {
      await manager.getRepository(IssuesProject).findOne({ where: { id: world.project.id }, lock: { mode: 'pessimistic_write' } });

      pending = bulk([issue.uuid], 'closed').then(() => { outcome = 'applied'; }, (error: unknown) => { outcome = error; });

      await until(() => lockWaiterOn(harness.ds, 'issues_projects'), 'the bulk call to wait on the project lock');
      await manager.query('UPDATE issues_projects SET deleted_at = NOW(), deleted_token = id WHERE id = ?', [world.project.id]);
      await manager.query('DELETE FROM issues WHERE id = ?', [issue.id]);
    });

    await pending;

    expect(outcome).toBeInstanceOf(NotFoundException);
    expect(await rowCount(harness, 'issues_pending_writes')).toBe(0);
    expect(harness.workers.paramsOf(ISSUES_RECONCILE_JOB)).toEqual([]);
  });

  it('E67: applies its changes when bulk commits first, then the deletion removes the issues and the queued T1 has nothing to push', async () => {
    const issue = await seedIssue(harness.ds, world.project.id);
    const link = await harness.ds.query(
      `INSERT INTO issues_github_links (user_id, issue_id, github_issue_id, github_number, status, base_title, base_body, base_state, created_at, updated_at)
       VALUES (?, ?, ?, 12, 'linked', 'x', NULL, 'open', NOW(), NOW())`,
      [world.userId, issue.id, 2 ** 31 + 9_600],
    ) as { insertId: number };
    const parked = parkAfterProjectLock();
    const bulking = bulk([issue.uuid], 'closed');

    await until(() => parked.entered(), 'the bulk call to take the project lock');

    const deleting = harness.get(ProjectsService).delete(world.userId, world.project.uuid);

    await until(() => lockWaiterOn(harness.ds, 'issues_projects'), 'the deletion to wait on the project lock');
    parked.open();

    expect((await bulking).changed).toEqual([issue.uuid]);
    await deleting;

    expect(harness.workers.paramsOf(ISSUES_RECONCILE_JOB)).toEqual([{ linkId: link.insertId }]);
    expect(await harness.ds.getRepository(Issue).countBy({ id: issue.id })).toBe(0);
    expect(await markers()).toEqual([]);
  });

  it('E68: writes the marker and a T1 when the attach commits first (the issue is linked by the time bulk locks it)', async () => {
    const issue = await seedIssue(harness.ds, world.project.id);
    let pending: Promise<unknown> = Promise.resolve();
    let linkId = 0;

    await harness.ds.transaction(async (manager) => {
      await manager.getRepository(IssuesProject).findOne({ where: { id: world.project.id }, lock: { mode: 'pessimistic_write' } });

      pending = bulk([issue.uuid], 'closed');

      await until(() => lockWaiterOn(harness.ds, 'issues_projects'), 'the bulk call to wait on the project lock');

      const inserted = await manager.query(
        `INSERT INTO issues_github_links (user_id, issue_id, github_issue_id, github_number, status, base_title, base_body, base_state, created_at, updated_at)
         VALUES (?, ?, ?, 12, 'linked', 'x', NULL, 'open', NOW(), NOW())`,
        [world.userId, issue.id, 2 ** 31 + 9_700],
      ) as { insertId: number };

      linkId = inserted.insertId;
    });

    await pending;

    expect((await markers()).map((row) => row.link_id)).toEqual([linkId]);
    expect(harness.workers.paramsOf(ISSUES_RECONCILE_JOB)).toEqual([{ linkId }]);
  });

  it('E68: moves updatedAt first when bulk commits before the attach, so the attach confirmation answers the stale 409 (E61)', async () => {
    const issue = await seedIssue(harness.ds, world.project.id, { title: 'Local', body: 'local body' });

    scriptIssue(harness, { title: 'Remote', body: 'local body' });

    const warned = (await linkApi(harness, world).attach(issue.uuid).expect(409)).body.error.meta.updatedAt as string;
    const parked = parkAfterProjectLock();
    const bulking = bulk([issue.uuid], 'closed');

    await until(() => parked.entered(), 'the bulk call to take the project lock');
    harness.clock.advance(5_000);

    const attaching = linkApi(harness, world).attach(issue.uuid, { number: 12, confirmUpdatedAt: warned }).then((response) => response);

    await until(() => lockWaiterOn(harness.ds, 'issues_projects'), 'the attach to wait on the project lock');
    parked.open();
    await bulking;

    const stale = await attaching;

    expect(stale.status).toBe(409);
    expect(stale.body.error.meta.updatedAt).not.toBe(warned);
    expect(await rowCount(harness, 'issues_github_links')).toBe(0);
  });

  it.each([1, 2, 3, 4, 5])('E69: two overlapping calls with opposite states neither deadlock nor mix, and each reports its own outcome (run %i)', async () => {
    const issues = [await seedIssue(harness.ds, world.project.id), await seedIssue(harness.ds, world.project.id), await seedIssue(harness.ds, world.project.id)];
    const uuids = issues.map((issue) => issue.uuid);
    const [closing, opening] = await Promise.all([bulk(uuids, 'closed'), bulk([...uuids].reverse(), 'open')]);
    const finals = await Promise.all(issues.map((issue) => stateOf(issue.id)));

    expect(closing.changed).toEqual(uuids);
    expect(closing.notFound).toEqual([]);
    expect(opening.notFound).toEqual([]);
    // Closing first, then opening: both change everything. Opening first: it finds them open already.
    if (opening.changed.length === 3) {
      expect(finals).toEqual(['open', 'open', 'open']);
    } else {
      expect(opening.unchanged).toEqual([...uuids].reverse());
      expect(finals).toEqual(['closed', 'closed', 'closed']);
    }
  });
});
