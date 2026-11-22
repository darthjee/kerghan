import { FakeClock } from '../../core/tests/support/fake-clock.js';
import { FRESH_MS, isFresh, IssueSyncTriggersService } from '../issue-sync-triggers.service.js';
import { FakeProjectRepositories } from './support/fake-project-repositories.js';

const NOW = new Date('2026-06-01T12:00:00Z');
const ago = (ms: number): Date => new Date(NOW.getTime() - ms);

describe('isFresh', () => {
  it.each([
    ['no marker, synced 59 s ago', false, ago(59_000), true],
    ['no marker, synced exactly 60 s ago', false, ago(60_000), false],
    ['no marker, synced long ago', false, ago(3_600_000), false],
    ['no marker, never synced', false, null, false],
    ['a marker, synced a second ago', true, ago(1_000), false],
  ])('%s -> %s', (_label, hasMarker, lastSyncedAt, expected) => {
    expect(isFresh(hasMarker, lastSyncedAt, NOW)).toBe(expected);
  });

  it('is 60 seconds', () => {
    expect(FRESH_MS).toBe(60_000);
  });
});

describe('IssueSyncTriggersService', () => {
  const link = { id: 5, status: 'sync_failed', lastSyncedAt: ago(600_000) };
  const issue = { id: 9, uuid: 'issue-uuid', projectId: 3, title: 'T', body: null, state: 'open', createdAt: NOW, updatedAt: NOW };
  const project = { id: 3, repositoryId: 30 };
  let access: { findLiveProject: jest.Mock; findIssueInProject: jest.Mock };
  let links: { findByIssue: jest.Mock; markLinked: jest.Mock; listSyncableByProject: jest.Mock };
  let markers: { findRevision: jest.Mock };
  let queue: { enqueue: jest.Mock };
  let service: IssueSyncTriggersService;

  beforeEach(() => {
    access = { findLiveProject: jest.fn(async () => project), findIssueInProject: jest.fn(async () => issue) };
    links = {
      findByIssue: jest.fn(async () => ({ ...link })),
      markLinked: jest.fn(async () => true),
      listSyncableByProject: jest.fn(async () => []),
    };
    markers = { findRevision: jest.fn(async () => null) };
    queue = { enqueue: jest.fn() };

    const repositories = new FakeProjectRepositories().seed(7, { repositoryId: 30, githubId: 300 });
    const presenter = { forIssues: jest.fn(async () => new Map()) };
    const dataSource = { manager: {}, transaction: jest.fn(async (fn: (manager: object) => unknown) => fn({})) };

    service = new IssueSyncTriggersService(
      access as never,
      links as never,
      markers as never,
      presenter as never,
      repositories as never,
      queue,
      new FakeClock(NOW),
      dataSource as never,
    );
  });

  it('T3 counts the enqueued and the skipped links, in the listed order', async () => {
    links.listSyncableByProject.mockResolvedValue([
      { linkId: 1, lastSyncedAt: null, hasMarker: false },
      { linkId: 2, lastSyncedAt: ago(10_000), hasMarker: false },
      { linkId: 3, lastSyncedAt: ago(10_000), hasMarker: true },
      { linkId: 4, lastSyncedAt: ago(500_000), hasMarker: false },
    ]);

    const result = await service.refreshProject(7, 'project-uuid');

    expect(result).toEqual({ status: 202, body: { enqueued: 3, skippedFresh: 1 } });
    expect(queue.enqueue.mock.calls).toEqual([[1], [3], [4]]);
  });

  it('T3 refuses a project with no repository before reading any link', async () => {
    access.findLiveProject.mockResolvedValue({ id: 3, repositoryId: null });

    await expect(service.refreshProject(7, 'project-uuid')).rejects.toMatchObject({ response: { code: 'PROJECT_HAS_NO_REPOSITORY' } });
    expect(links.listSyncableByProject).not.toHaveBeenCalled();
  });

  it('T4 resets and enqueues a sync_failed link', async () => {
    const result = await service.retrySync(7, 'project-uuid', 'issue-uuid');

    expect(result.status).toBe(202);
    expect(links.markLinked).toHaveBeenCalledWith(expect.anything(), 5, NOW);
    expect(queue.enqueue).toHaveBeenCalledWith(5);
  });

  it('T4 is a no-op for a linked link', async () => {
    links.findByIssue.mockResolvedValue({ ...link, status: 'linked' });

    expect((await service.retrySync(7, 'project-uuid', 'issue-uuid')).status).toBe(200);
    expect(links.markLinked).not.toHaveBeenCalled();
    expect(queue.enqueue).not.toHaveBeenCalled();
  });

  it('T4 refuses a link that turned gone between the read and the reset, enqueuing nothing', async () => {
    links.markLinked.mockResolvedValue(false);

    await expect(service.retrySync(7, 'project-uuid', 'issue-uuid')).rejects.toMatchObject({ response: { code: 'ISSUE_LINK_GONE' } });
    expect(queue.enqueue).not.toHaveBeenCalled();
  });

  it('T2 reads the marker before deciding, and enqueues a link with one even when fresh', async () => {
    links.findByIssue.mockResolvedValue({ ...link, status: 'linked', lastSyncedAt: ago(1_000) });
    markers.findRevision.mockResolvedValue({ revision: 1 });

    expect((await service.refreshIssue(7, 'project-uuid', 'issue-uuid')).status).toBe(202);
    expect(queue.enqueue).toHaveBeenCalledWith(5);
  });
});
