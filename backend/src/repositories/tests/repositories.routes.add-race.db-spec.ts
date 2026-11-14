import { reposOf, seedRepo, seedStatus } from './support/repo-rows.js';
import {
  buildRepositoriesHttpDbHarness,
  HARNESS_START,
  post,
  type RepositoriesHttpDbHarness,
  until,
  waitForCalls,
} from './support/repositories-http-db-harness.js';
import { ref } from './support/sync-harness.js';
import { seedTwoUserBaseline, snapshotUserRows } from './support/two-user-baseline.js';
import { repository } from '../../integrations/tests/support/github-builders.js';
import { HandleReconciler } from '../handle-reconciler.js';
import { RepositoriesService } from '../repositories.service.js';
import type { MarkAddedOutcome } from '../types/repositories-api.types.js';

const GITHUB_ID = 3_000_000_001;

describe('Concurrent Adds over HTTP (real MySQL)', () => {
  let harness: RepositoriesHttpDbHarness;
  let userId: number;
  let intruderId: number;
  let cookie: string;
  let intruderBefore: Record<string, unknown[]>;

  beforeEach(async () => {
    harness = await buildRepositoriesHttpDbHarness();
    ({ userId, intruderId } = await seedTwoUserBaseline(harness.ds));
    intruderBefore = await snapshotUserRows(harness.ds, intruderId);
    cookie = harness.sessionFor(userId);
    await harness.get(HandleReconciler).forRequest(userId);
    await seedRepo(harness.ds, userId, { githubId: GITHUB_ID, owner: 'octo', name: 'race', sources: [['integration:5', 1]] });
    await seedStatus(harness.ds, userId, 'integration:5', 'ok');
    harness.github.setUsable(userId, [ref(5)]);
  });

  afterEach(async () => {
    expect(await snapshotUserRows(harness.ds, intruderId)).toEqual(intruderBefore);
    await harness.close();
  });

  it('both answer 200 with the same addedAt and access link, and only one write happens', async () => {
    const service = harness.get(RepositoriesService);
    const outcomes: MarkAddedOutcome['kind'][] = [];
    const markAdded = service.markAdded.bind(service);
    jest.spyOn(service, 'markAdded').mockImplementation(async (...args) => {
      const outcome = await markAdded(...args);

      outcomes.push(outcome.kind);
      return outcome;
    });
    const first = harness.github.hold(5, 'getRepository', GITHUB_ID);
    const second = harness.github.hold(5, 'getRepository', GITHUB_ID);
    const answer = repository({ githubId: GITHUB_ID, owner: 'octo', name: 'race', private: false });

    // Both requests pass the lookup and the already-added check before either writes.
    const requests = [post(harness, '/repositories/add.json', cookie, { githubId: GITHUB_ID }).then((response) => response),
      post(harness, '/repositories/add.json', cookie, { githubId: GITHUB_ID }).then((response) => response)];

    await waitForCalls(harness, (call) => call.operation === 'getRepository', 2);
    first.resolve(answer);
    await until(() => outcomes.length === 1, 'the first write');
    harness.clock.advance(5_000);
    second.resolve(answer);

    const [a, b] = await Promise.all(requests);

    expect([a.status, b.status]).toEqual([200, 200]);
    expect(a.body.addedAt).toBe(HARNESS_START.toISOString());
    expect(b.body.addedAt).toBe(a.body.addedAt);
    expect(a.body.accessIntegration).toEqual({ uuid: 'uuid-5', label: 'label-5' });
    expect(b.body.accessIntegration).toEqual(a.body.accessIntegration);
    expect(outcomes.sort()).toEqual(['added', 'already_added']);
    expect(await reposOf(harness.ds, userId)).toMatchObject([{ added_at: HARNESS_START, integration_id: 5 }]);
  });
});
