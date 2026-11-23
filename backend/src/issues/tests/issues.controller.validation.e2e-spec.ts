import { call, useIssuesTestApp } from './support/build-issues-test-app.js';
import { ErrorCodes } from '../../core/error-codes.js';

const PROJECT_ID = '3f2a0000-0000-4000-8000-0000000000c9';
const ISSUE_ID = '3f2a0000-0000-4000-8000-0000000000d1';
const ISO_TIMESTAMP = /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}\.\d{3}Z$/;
// 256 emoji are 256 code points (and 512 UTF-16 units); 257 are over the limit.
const EMOJI_256 = '😀'.repeat(256);
const EMOJI_257 = '😀'.repeat(257);
const LIST = `/projects/${PROJECT_ID}/issues.json`;
const CREATE = `/projects/${PROJECT_ID}/issues/create.json`;
const BULK = `/projects/${PROJECT_ID}/issues/bulk-state.json`;
const EDIT = `/projects/${PROJECT_ID}/issues/${ISSUE_ID}/edit.json`;

describe('IssuesController validation (e2e)', () => {
  const { ctx } = useIssuesTestApp();

  const post = (path: string, body: Record<string, unknown> = {}) => call(ctx.app, 'post', path, ctx.owner).send(body);

  /** Asserts a `400 VALIDATION_FAILED` with details, and that the service was never reached. */
  async function expectInvalid(path: string, body: Record<string, unknown>): Promise<void> {
    const response = await post(path, body);

    expect(response.status).toBe(400);
    expect(response.body).toEqual({
      error: { code: ErrorCodes.VALIDATION_FAILED, message: expect.any(String), details: expect.any(Array) },
      statusCode: 400,
      timestamp: expect.stringMatching(ISO_TIMESTAMP),
    });
    expect(response.body.error).not.toHaveProperty('meta');
    expect(ctx.issues.calls).toEqual([]);
  }

  describe('POST /projects/:projectId/issues.json', () => {
    it.each([
      ['a string page', { page: '1' }],
      ['a zero page', { page: 0 }],
      ['a null page', { page: null }],
      ['a perPage of 0', { perPage: 0 }],
      ['a perPage of 101', { perPage: 101 }],
      ['a string perPage', { perPage: '10' }],
      ['a bad state', { state: 'merged' }],
      ['a null state', { state: null }],
      ['a numeric search', { search: 5 }],
      ['a null search', { search: null }],
      ['a 101 code point search', { search: 'a'.repeat(101) }],
    ])('rejects %s', async (_label, body) => {
      await expectInvalid(LIST, body);
    });

    it('applies the defaults and strips unknown properties', async () => {
      await post(LIST, { userId: 99, extra: true }).expect(200);

      expect(ctx.issues.callsOf('list')[0].args).toEqual([PROJECT_ID, { page: 1, perPage: 50, state: 'open', search: '' }]);
    });

    it('accepts each state filter and the largest perPage', async () => {
      for (const state of ['open', 'closed', 'all']) await post(LIST, { state, perPage: 100 }).expect(200);
    });
  });

  describe('POST /projects/:projectId/issues/create.json', () => {
    it.each([
      ['a missing title', {}],
      ['a null title', { title: null }],
      ['a blank title', { title: '   ' }],
      ['an empty title', { title: '' }],
      ['a numeric title', { title: 5 }],
      ['a 257 code point title', { title: 'a'.repeat(257) }],
      ['257 emoji as a title', { title: EMOJI_257 }],
      ['a numeric body', { title: 'x', body: 1 }],
      ['a boolean body', { title: 'x', body: true }],
      ['a 65537 code point body', { title: 'x', body: 'a'.repeat(65537) }],
      ['a bad state', { title: 'x', state: 'all' }],
      ['a null state', { title: 'x', state: null }],
      ['a numeric state', { title: 'x', state: 1 }],
    ])('rejects %s', async (_label, body) => {
      await expectInvalid(CREATE, body);
    });

    it('accepts 256 emoji as a title, trims it, keeps the body as it is and defaults the state', async () => {
      await post(CREATE, { title: ` ${EMOJI_256} `, body: '  keep  ' }).expect(201);

      expect(ctx.issues.callsOf('create')[0].args).toEqual([PROJECT_ID, { title: EMOJI_256, body: '  keep  ', state: 'open' }]);
    });

    it.each([['', null], [null, null], [' ', ' ']])('stores a body of %j as %j', async (body, expected) => {
      await post(CREATE, { title: 'x', body }).expect(201);

      expect((ctx.issues.callsOf('create')[0].args[1] as { body: unknown }).body).toBe(expected);
    });
  });

  describe('POST /projects/:projectId/issues/:issueId/edit.json', () => {
    it.each([
      ['a null title', { title: null }],
      ['a blank title', { title: '  ' }],
      ['a numeric title', { title: 1 }],
      ['a 257 code point title', { title: 'a'.repeat(257) }],
      ['a numeric body', { body: 1 }],
      ['a 65537 code point body', { body: 'a'.repeat(65537) }],
      ['a null state', { state: null }],
      ['a bad state', { state: 'all' }],
      ['a boolean state', { state: true }],
    ])('rejects %s', async (_label, body) => {
      await expectInvalid(EDIT, body);
    });

    it('passes an absent member as absent and a cleared body as null', async () => {
      await post(EDIT, {}).expect(200);
      await post(EDIT, { body: '' }).expect(200);
      await post(EDIT, { body: null, state: 'closed' }).expect(200);

      expect(ctx.issues.callsOf('edit').map((entry) => entry.args[2])).toEqual([{}, { body: null }, { body: null, state: 'closed' }]);
    });

    it('accepts a 65536 code point body', async () => {
      await post(EDIT, { body: 'a'.repeat(65536) }).expect(200);
    });
  });

  describe('POST /projects/:projectId/issues/bulk-state.json', () => {
    const uuid = (n: number): string => `00000000-0000-4000-8000-${String(n).padStart(12, '0')}`;
    const ids = (count: number): string[] => Array.from({ length: count }, (_value, index) => uuid(index + 1));

    it.each([
      ['a missing issueIds', { state: 'open' }],
      ['a null issueIds', { issueIds: null, state: 'open' }],
      ['a string issueIds', { issueIds: uuid(1), state: 'open' }],
      ['an empty issueIds', { issueIds: [], state: 'open' }],
      ['101 ids', { issueIds: ids(101), state: 'open' }],
      ['a numeric item', { issueIds: [1], state: 'open' }],
      ['a non-uuid item', { issueIds: ['nope'], state: 'open' }],
      ['an exact duplicate', { issueIds: [uuid(1), uuid(1)], state: 'open' }],
      ['a duplicate differing by case', { issueIds: ['abcdefab-0000-4000-8000-000000000001', 'ABCDEFAB-0000-4000-8000-000000000001'], state: 'open' }],
      ['a missing state', { issueIds: ids(1) }],
      ['a null state', { issueIds: ids(1), state: null }],
      ['a bad state', { issueIds: ids(1), state: 'all' }],
    ])('rejects %s', async (_label, body) => {
      await expectInvalid(BULK, body);
    });

    it('accepts 100 ids and answers 200, passing the ids lowercased in request order', async () => {
      const upper = 'ABCDEFAB-0000-4000-8000-000000000001';
      const response = await post(BULK, { issueIds: [upper, ...ids(99)], state: 'closed' }).expect(200);

      expect(response.body.state).toBe('closed');
      expect(ctx.issues.callsOf('bulkState')[0].args).toEqual([
        PROJECT_ID,
        { issueIds: [upper.toLowerCase(), ...ids(99)], state: 'closed' },
      ]);
    });

    it('strips unknown properties', async () => {
      await post(BULK, { issueIds: ids(1), state: 'open', userId: 99 }).expect(200);

      expect(ctx.issues.callsOf('bulkState')[0].args).toEqual([PROJECT_ID, { issueIds: ids(1), state: 'open' }]);
    });
  });
});
