import { Pruner } from '../pruner.js';
import { reposOf, seedRepo, seedStatus, sourcesOf } from './support/repo-rows.js';
import { buildRepositoriesDbHarness, type RepositoriesDbHarness } from './support/repositories-db-harness.js';
import { seedTwoUserBaseline, snapshotUserRows } from './support/two-user-baseline.js';

const ADDED = new Date('2026-05-02T00:00:00Z');

describe('Pruner (real MySQL)', () => {
  let harness: RepositoriesDbHarness;

  beforeAll(async () => {
    harness = await buildRepositoriesDbHarness();
  });

  afterAll(() => harness.close());

  it('deletes only not-added repos with no source row; failed-source-held and added repos stay; the intruder is untouched', async () => {
    const { userId, intruderId } = await seedTwoUserBaseline(harness.ds);

    // The intruder's not-added repo loses its sources: only the user's prune runs, so it must stay.
    await harness.ds.query('DELETE FROM repositories_sources WHERE user_id = ?', [intruderId]);
    const intruderBefore = await snapshotUserRows(harness.ds, intruderId);
    await seedRepo(harness.ds, userId, { githubId: 1 });
    await seedRepo(harness.ds, userId, { githubId: 2, addedAt: ADDED });
    await seedRepo(harness.ds, userId, { githubId: 3, sources: [['integration:5', 1]] });
    await seedStatus(harness.ds, userId, 'integration:5', 'error');

    const pruned = await harness.ds.transaction((manager) => harness.get(Pruner).prune(manager, userId));

    expect(pruned).toBe(1);
    expect((await reposOf(harness.ds, userId)).map((row) => row.github_id)).toEqual(['2', '3']);
    expect(await snapshotUserRows(harness.ds, intruderId)).toEqual(intruderBefore);
  });

  it('drops the given sources\' source, page and status rows of one user only', async () => {
    const { userId, intruderId } = await seedTwoUserBaseline(harness.ds);
    const intruderBefore = await snapshotUserRows(harness.ds, intruderId);

    await seedRepo(harness.ds, userId, { githubId: 1, sources: [['handle', 1], ['integration:5', 1]] });
    await seedStatus(harness.ds, userId, 'handle', 'ok');

    await harness.ds.transaction((manager) => harness.get(Pruner).dropSources(manager, userId, ['handle']));
    await harness.ds.transaction((manager) => harness.get(Pruner).dropSources(manager, userId, []));

    expect(await sourcesOf(harness.ds, userId)).toEqual(['1|integration:5|1']);
    expect(await snapshotUserRows(harness.ds, intruderId)).toEqual(intruderBefore);
  });
});
