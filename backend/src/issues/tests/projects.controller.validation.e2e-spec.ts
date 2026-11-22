import { call, useIssuesTestApp } from './support/build-issues-test-app.js';
import { ErrorCodes } from '../../core/error-codes.js';

const PROJECT_ID = '3f2a0000-0000-4000-8000-0000000000c9';
const ISO_TIMESTAMP = /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}\.\d{3}Z$/;
// 100 emoji are 100 code points (and 200 UTF-16 units); 101 are over the limit.
const EMOJI_100 = '😀'.repeat(100);
const EMOJI_101 = '😀'.repeat(101);

describe('ProjectsController validation (e2e)', () => {
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
    expect(ctx.projects.calls).toEqual([]);
  }

  // The malformed path id cases live in the access matrix (`issues-routes.access-matrix.e2e-spec.ts`).

  describe('POST /projects/mine.json', () => {
    it.each([
      ['a string page', { page: '1' }],
      ['a zero page', { page: 0 }],
      ['a null page', { page: null }],
      ['a fractional page', { page: 1.5 }],
      ['a perPage of 0', { perPage: 0 }],
      ['a perPage of 101', { perPage: 101 }],
      ['a string perPage', { perPage: '10' }],
      ['a null perPage', { perPage: null }],
      ['a numeric search', { search: 5 }],
      ['a null search', { search: null }],
      ['a 101 code point search', { search: 'a'.repeat(101) }],
      ['101 emoji as a search', { search: EMOJI_101 }],
    ])('rejects %s', async (_label, body) => {
      await expectInvalid('/projects/mine.json', body);
    });

    it('accepts 100 emoji as a search (code points, not UTF-16 units) and the largest perPage', async () => {
      await post('/projects/mine.json', { search: EMOJI_100, perPage: 100 }).expect(200);
    });

    it('strips unknown properties', async () => {
      await post('/projects/mine.json', { userId: 99, extra: true }).expect(200);

      expect(ctx.projects.callsOf('list')[0].args).toEqual([{ page: 1, perPage: 50, search: '' }]);
    });
  });

  describe('POST /projects/create.json', () => {
    it.each([
      ['a missing name', {}],
      ['a null name', { name: null }],
      ['a blank name', { name: '   ' }],
      ['an empty name', { name: '' }],
      ['a numeric name', { name: 5 }],
      ['a 101 code point name', { name: 'a'.repeat(101) }],
      ['101 emoji as a name', { name: EMOJI_101 }],
      ['a numeric description', { name: 'x', description: 5 }],
      ['a 2001 code point description', { name: 'x', description: 'a'.repeat(2001) }],
      ['2001 emoji as a description', { name: 'x', description: '😀'.repeat(2001) }],
      ['a string repository', { name: 'x', repository: 'darthjee/kerghan' }],
      ['an array repository', { name: 'x', repository: [] }],
      ['a repository with neither field', { name: 'x', repository: {} }],
      ['a repository with both fields', { name: 'x', repository: { githubId: 1, fullName: 'o/r' } }],
      ['a malformed fullName', { name: 'x', repository: { fullName: 'nope' } }],
      ['a string githubId', { name: 'x', repository: { githubId: '1' } }],
    ])('rejects %s', async (_label, body) => {
      await expectInvalid('/projects/create.json', body);
    });

    it('accepts 100 emoji as a name and 2000 as a description, and trims both', async () => {
      await post('/projects/create.json', { name: ` ${EMOJI_100} `, description: `  ${'😀'.repeat(2000)}  ` }).expect(201);

      expect(ctx.projects.callsOf('create')[0].args[0]).toEqual({ name: EMOJI_100, description: '😀'.repeat(2000), repository: null });
    });
  });

  describe('POST /projects/from-repository.json', () => {
    it.each([
      ['a missing repository', {}],
      ['a null repository', { repository: null }],
      ['a null name', { repository: { githubId: 1 }, name: null }],
      ['a blank name', { repository: { githubId: 1 }, name: '  ' }],
      ['a long name', { repository: { githubId: 1 }, name: 'a'.repeat(101) }],
      ['a numeric description', { repository: { githubId: 1 }, description: 5 }],
    ])('rejects %s', async (_label, body) => {
      await expectInvalid('/projects/from-repository.json', body);
    });
  });

  describe('POST /projects/:projectId/edit.json', () => {
    it.each([
      ['a null name', { name: null }],
      ['a blank name', { name: '  ' }],
      ['a numeric name', { name: 1 }],
      ['a long name', { name: 'a'.repeat(101) }],
      ['a numeric description', { description: 1 }],
      ['a long description', { description: 'a'.repeat(2001) }],
    ])('rejects %s', async (_label, body) => {
      await expectInvalid(`/projects/${PROJECT_ID}/edit.json`, body);
    });
  });

  describe('POST /projects/:projectId/repository.json', () => {
    it.each([
      ['an absent repository key', {}],
      ['a string repository', { repository: 'o/r' }],
      ['a repository with neither field', { repository: {} }],
      ['a repository with both fields', { repository: { githubId: 1, fullName: 'o/r' } }],
    ])('rejects %s', async (_label, body) => {
      await expectInvalid(`/projects/${PROJECT_ID}/repository.json`, body);
    });
  });
});
