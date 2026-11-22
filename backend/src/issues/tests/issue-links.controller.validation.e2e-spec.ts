import { call, useIssuesTestApp } from './support/build-issues-test-app.js';
import { ErrorCodes } from '../../core/error-codes.js';

const PROJECT_ID = '3f2a0000-0000-4000-8000-0000000000c9';
const ISSUE_ID = '3f2a0000-0000-4000-8000-0000000000d1';
const ISO_TIMESTAMP = /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}\.\d{3}Z$/;
const IMPORT = `/projects/${PROJECT_ID}/issues/import.json`;
const ATTACH = `/projects/${PROJECT_ID}/issues/${ISSUE_ID}/attach.json`;
const UNLINK = `/projects/${PROJECT_ID}/issues/${ISSUE_ID}/unlink.json`;
const CONFIRM = '2026-11-17T12:00:00.123Z';

const BAD_NUMBERS: Array<[string, Record<string, unknown>]> = [
  ['a missing number', {}],
  ['a null number', { number: null }],
  ['a string number', { number: '12' }],
  ['a decimal number', { number: 1.5 }],
  ['a zero number', { number: 0 }],
  ['a negative number', { number: -1 }],
  ['a number over 2147483647', { number: 2_147_483_648 }],
  ['a boolean number', { number: true }],
];

describe('IssueLinksController validation (e2e)', () => {
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
    expect(ctx.links.calls).toEqual([]);
  }

  describe('POST /projects/:projectId/issues/import.json', () => {
    it.each(BAD_NUMBERS)('rejects %s', async (_label, body) => {
      await expectInvalid(IMPORT, body);
    });

    it('accepts the bounds, and strips unknown properties', async () => {
      await post(IMPORT, { number: 1 }).expect(201);
      await post(IMPORT, { number: 2_147_483_647, title: 'x', userId: 9 }).expect(201);

      expect(ctx.links.callsOf('import').map((entry) => entry.args)).toEqual([
        [PROJECT_ID, { number: 1 }],
        [PROJECT_ID, { number: 2_147_483_647 }],
      ]);
    });
  });

  describe('POST /projects/:projectId/issues/:issueId/attach.json', () => {
    it.each([
      ...BAD_NUMBERS,
      ['a non-string confirmUpdatedAt', { number: 1, confirmUpdatedAt: 5 }],
      ['a null confirmUpdatedAt', { number: 1, confirmUpdatedAt: null }],
      ['a date without milliseconds', { number: 1, confirmUpdatedAt: '2026-11-17T12:00:00Z' }],
      ['a date with an offset', { number: 1, confirmUpdatedAt: '2026-11-17T12:00:00.123+02:00' }],
      ['a date-only confirmUpdatedAt', { number: 1, confirmUpdatedAt: '2026-11-17' }],
      ['an impossible date', { number: 1, confirmUpdatedAt: '2026-13-45T12:00:00.123Z' }],
      ['free text as confirmUpdatedAt', { number: 1, confirmUpdatedAt: 'yesterday' }],
    ])('rejects %s', async (_label, body) => {
      await expectInvalid(ATTACH, body);
    });

    it('passes the confirmation on as a Date, and leaves it absent when not sent', async () => {
      await post(ATTACH, { number: 4, confirmUpdatedAt: CONFIRM }).expect(200);
      await post(ATTACH, { number: 5 }).expect(200);

      expect(ctx.links.callsOf('attach').map((entry) => entry.args)).toEqual([
        [PROJECT_ID, ISSUE_ID, { number: 4, confirmUpdatedAt: new Date(CONFIRM) }],
        [PROJECT_ID, ISSUE_ID, { number: 5 }],
      ]);
    });
  });

  describe('POST /projects/:projectId/issues/:issueId/unlink.json', () => {
    it.each([
      ['a string flag', { discardUnsentChanges: 'true' }],
      ['a numeric flag', { discardUnsentChanges: 1 }],
      ['a null flag', { discardUnsentChanges: null }],
    ])('rejects %s', async (_label, body) => {
      await expectInvalid(UNLINK, body);
    });

    it('defaults the flag to false and only an explicit true discards', async () => {
      await post(UNLINK).expect(200);
      await post(UNLINK, { discardUnsentChanges: false }).expect(200);
      await post(UNLINK, { discardUnsentChanges: true, extra: 1 }).expect(200);

      expect(ctx.links.callsOf('unlink').map((entry) => entry.args)).toEqual([
        [PROJECT_ID, ISSUE_ID, { discardUnsentChanges: false }],
        [PROJECT_ID, ISSUE_ID, { discardUnsentChanges: false }],
        [PROJECT_ID, ISSUE_ID, { discardUnsentChanges: true }],
      ]);
    });
  });
});
