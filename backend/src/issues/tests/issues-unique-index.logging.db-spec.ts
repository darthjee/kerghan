import type request from 'supertest';
import { githubIssue, issue as issueCase } from '../../integrations/tests/support/github-builders.js';
import { ISSUES_UNIQUE_INDEX_MAPPINGS, LINK_ISSUE_INDEX, LINK_USER_GITHUB_ISSUE_INDEX, MARKER_LINK_INDEX, PROJECT_NAME_INDEX, PROJECT_REPOSITORY_INDEX } from '../duplicate-entry.js';
import { expectNoCanary, serializeLogs } from './support/canary-assertions.js';
import { buildCanaryWorld, CANARY_NUMBER, type CanaryContent, type CanaryWorld } from './support/canary-world.js';
import { buildIssuesCanaryHarness, postAs, type IssuesCanaryHarness } from './support/issues-canary-harness.js';
import { linkIssue } from './support/sync-outcomes.js';

// A unique-index duplicate never reaches the logs (docs/agents/modules/issues/security.md, "Exception messages never reach the logs"):
// MySQL's `ER_DUP_ENTRY` message carries the duplicated value, which can be a project name. Every unique
// index of the Issues tables has a row below: the duplicate is provoked through its route, one call after
// the other and both at once, answers the mapped 409 (or the shortcut's 200), and its value is in no log line.
const DUPLICATE = 'CANARYduplicateVALUE';
const RUNS = [1, 2, 3];
const LIMIT = 1000;

const statusOf = (response: request.Response): string => (response.status < 300 ? String(response.status) : String(response.body.error?.code ?? response.status));

describe('Issues unique-index duplicates are mapped and never logged (real MySQL)', () => {
  let harness: IssuesCanaryHarness;

  beforeAll(async () => {
    harness = await buildIssuesCanaryHarness({ KERGHAN_ISSUES_LINK_MAX_PER_WINDOW: `${LIMIT}`, KERGHAN_ISSUES_EDIT_MAX_PER_WINDOW: `${LIMIT}` });
  });

  afterAll(() => harness.close());

  const call = (w: CanaryWorld, path: string, body: Record<string, unknown> = {}, cookie = w.cookie) => postAs(harness, path, cookie, body);
  const together = (calls: Array<() => request.Test>): Promise<string[]> => Promise.all(calls.map(async (run) => statusOf(await run())));
  const expectNotLogged = (): void => {
    const logged = serializeLogs(harness.logs);

    expectNoCanary([logged], [DUPLICATE, 'ER_DUP_ENTRY', 'Duplicate entry', 'duplicate key']);
  };

  /** How to provoke one index: the world to seed, what GitHub holds, a duplicate one call after the other, and two writes at once. */
  interface Provocation {
    content?: CanaryContent;
    /** What GitHub answers for issue numbers 12 and 13 (distinct GitHub ids). */
    github?: { title: string; body: string };
    /** The statuses of the sequential calls, in order. */
    sequential: { run(w: CanaryWorld): Promise<string[]>; expect: string[] };
    /** The statuses of two simultaneous calls (sorted). */
    concurrent: { run(w: CanaryWorld): Promise<string[]>; expect: string[] };
  }

  const link = (w: CanaryWorld, number = CANARY_NUMBER, issueUuid?: string) => (issueUuid === undefined
    ? call(w, `/projects/${w.project.uuid}/issues/import.json`, { number })
    : call(w, `/projects/${w.project.uuid}/issues/${issueUuid}/attach.json`, { number }));
  const edit = (w: CanaryWorld, title: string) => call(w, `/projects/${w.project.uuid}/issues/${w.issue.uuid}/edit.json`, { title });
  const create = (w: CanaryWorld, body: Record<string, unknown>) => call(w, '/projects/create.json', body);

  /** One row per unique index; the uuid indexes cannot be provoked (random v4 uuids). */
  const PROVOCATIONS: Record<string, Provocation> = {
    [PROJECT_NAME_INDEX]: {
      sequential: {
        run: async (w) => {
          const first = await create(w, { name: DUPLICATE });
          const second = await create(w, { name: DUPLICATE });
          const other = await create(w, { name: `${DUPLICATE} other` });
          const rename = await call(w, `/projects/${other.body.id}/edit.json`, { name: DUPLICATE });

          return [first, second, other, rename].map(statusOf);
        },
        expect: ['201', 'PROJECT_NAME_TAKEN', '201', 'PROJECT_NAME_TAKEN'],
      },
      concurrent: { run: (w) => together([1, 2].map(() => () => create(w, { name: DUPLICATE }))), expect: ['201', 'PROJECT_NAME_TAKEN'] },
    },
    [PROJECT_REPOSITORY_INDEX]: {
      sequential: {
        run: async (w) => [
          await create(w, { name: `${DUPLICATE} repo`, repository: { githubId: 700 } }),
          await call(w, '/projects/from-repository.json', { repository: { githubId: 700 } }),
        ].map(statusOf),
        expect: ['PROJECT_REPOSITORY_TAKEN', '200'],
      },
      concurrent: {
        run: async (w) => {
          await harness.ds.query('UPDATE issues_projects SET repository_id = NULL WHERE id = ?', [w.project.id]);

          return together([1, 2].map((turn) => () => create(w, { name: `${DUPLICATE} repo ${turn}`, repository: { githubId: 700 } })));
        },
        expect: ['201', 'PROJECT_REPOSITORY_TAKEN'],
      },
    },
    [LINK_USER_GITHUB_ISSUE_INDEX]: {
      sequential: { run: async (w) => [await link(w), await link(w)].map(statusOf), expect: ['201', 'GITHUB_ISSUE_ALREADY_LINKED'] },
      concurrent: { run: (w) => together([1, 2].map(() => () => link(w))), expect: ['201', 'GITHUB_ISSUE_ALREADY_LINKED'] },
    },
    [LINK_ISSUE_INDEX]: {
      content: { issueTitle: DUPLICATE, issueBody: DUPLICATE },
      github: { title: DUPLICATE, body: DUPLICATE },
      sequential: { run: async (w) => [await link(w, 12, w.issue.uuid), await link(w, 13, w.issue.uuid)].map(statusOf), expect: ['200', 'ISSUE_ALREADY_LINKED'] },
      concurrent: { run: (w) => together([12, 13].map((number) => () => link(w, number, w.issue.uuid))), expect: ['200', 'ISSUE_ALREADY_LINKED'] },
    },
    [MARKER_LINK_INDEX]: {
      sequential: {
        run: async (w) => {
          await linkIssue(harness, w);

          return [await edit(w, `${DUPLICATE} one`), await edit(w, `${DUPLICATE} two`)].map(statusOf);
        },
        expect: ['200', '200'],
      },
      concurrent: {
        run: async (w) => {
          await linkIssue(harness, w);

          return together(['a', 'b'].map((turn) => () => edit(w, `${DUPLICATE} ${turn}`)));
        },
        expect: ['200', '200'],
      },
    },
  };

  it('has a row for every unique index the entities declare, and the mapping list names exactly those', () => {
    const declared = harness.ds.entityMetadatas
      .filter((metadata) => metadata.tableName.startsWith('issues'))
      .flatMap((metadata) => metadata.indices.filter((index) => index.isUnique).map((index) => index.name))
      .sort();

    expect(declared.length).toBeGreaterThan(0);
    expect(ISSUES_UNIQUE_INDEX_MAPPINGS.map((entry) => entry.index).sort()).toEqual(declared);
    expect(Object.keys(PROVOCATIONS).sort()).toEqual(declared.filter((index) => !index.endsWith('uuid')));
  });

  describe.each(ISSUES_UNIQUE_INDEX_MAPPINGS.filter((entry) => !entry.index.endsWith('uuid')).map((entry) => [entry.index, entry.mappedBy] as const))('%s (%s)', (index) => {
    const provocation = PROVOCATIONS[index];

    /** Seeds the world and what GitHub holds: both issue numbers answer an issue with the duplicated values and its own id. */
    async function arrange(): Promise<CanaryWorld> {
      const github = provocation.github ?? { title: 'Remote', body: 'Local body' };
      const remote = (id: number, number: number) => issueCase(
        githubIssue({ id, number, title: github.title, body: github.body, updatedAt: new Date('2026-06-01T11:00:00Z') }), { etag: 'W/"g1"' },
      );

      const world = await buildCanaryWorld(harness, ['pat'], provocation.content ?? { projectName: 'Owner project' });

      harness.github.readsFor(12, remote(2 ** 31 + 9_012, 12)).readsFor(13, remote(2 ** 31 + 9_013, 13));

      return world;
    }

    it('answers the mapped status for the duplicate one call after the other, and logs nothing of it', async () => {
      const w = await arrange();

      expect(await provocation.sequential.run(w)).toEqual(provocation.sequential.expect);
      expectNotLogged();
    });

    it.each(RUNS)('answers the mapped status for two writes at once, never a 500 (run %i)', async () => {
      const w = await arrange();

      expect((await provocation.concurrent.run(w)).sort()).toEqual([...provocation.concurrent.expect].sort());
      expectNotLogged();
    });
  });

  // MySQL's message carries the name unescaped before the real `for key '...'` suffix: a name that imitates
  // that suffix must neither hide the violated index (a 500 instead of the 409) nor reach the logs.
  describe('a project name imitating the key suffix of the duplicate-entry message', () => {
    const IMITATION = 'CANARYimitateVALUE';
    const NAME = `${IMITATION}' for key '${PROJECT_NAME_INDEX}`;
    const expectImitationNotLogged = (): void => expectNoCanary([serializeLogs(harness.logs)], [IMITATION, 'ER_DUP_ENTRY', 'Duplicate entry', 'duplicate key']);

    it('answers 409 PROJECT_NAME_TAKEN on creation and on rename, and logs nothing of the name', async () => {
      const w = await buildCanaryWorld(harness, ['pat'], { projectName: 'Owner project' });
      const first = await create(w, { name: NAME });
      const second = await create(w, { name: NAME });
      const other = await create(w, { name: `${IMITATION} other` });
      const rename = await call(w, `/projects/${other.body.id}/edit.json`, { name: NAME });

      expect([first, second, other, rename].map(statusOf)).toEqual(['201', 'PROJECT_NAME_TAKEN', '201', 'PROJECT_NAME_TAKEN']);
      expectImitationNotLogged();
    });

    it('answers 409 PROJECT_NAME_TAKEN for two creations at once, never a 500', async () => {
      const w = await buildCanaryWorld(harness, ['pat'], { projectName: 'Owner project' });

      expect((await together([1, 2].map(() => () => create(w, { name: NAME })))).sort()).toEqual(['201', 'PROJECT_NAME_TAKEN']);
      expectImitationNotLogged();
    });
  });

  it('documents the uuid indexes as unreachable: a random v4 uuid cannot be chosen by a request', () => {
    expect(ISSUES_UNIQUE_INDEX_MAPPINGS.filter((entry) => entry.index.endsWith('uuid')).map((entry) => entry.mappedBy)).toEqual([
      'a random v4 uuid: no route can provoke it',
      'a random v4 uuid: no route can provoke it',
    ]);
  });
});
