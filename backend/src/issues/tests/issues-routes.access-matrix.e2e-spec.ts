import type request from 'supertest';
import { expectErrorBody } from '../../auth/tests/support/error-body.js';
import { ErrorCodes } from '../../core/error-codes.js';
import { issueNotFound, projectNotFound } from '../issues-http-errors.js';
import {
  call,
  expectNeverCached,
  expectNoForbiddenKeys,
  useIssuesTestApp,
  withoutTimestamp,
} from './support/build-issues-test-app.js';
import { sampleIssue } from './support/fake-issues.service.js';
import { sampleProject } from './support/fake-projects.service.js';
import { ISSUE_ID, PROJECT_ID, registeredRoutes } from './support/registered-routes.js';

const CROSS_SITE = { 'Sec-Fetch-Site': 'cross-site', Origin: 'https://evil.example' };

type Service = 'projects' | 'issues' | 'links';

/** One row of the route access matrix: every route of the Issues module (`testing.md#security-verification`). */
interface MatrixRow {
  /** The fake behind the route. */
  service: Service;
  path: string;
  /** A body the route accepts. */
  body: Record<string, unknown>;
  /** A body the route's DTO rejects, or `null` for a route that reads none. */
  invalidBody: Record<string, unknown> | null;
  success: number;
  /** The service method behind the route, to make it fail inside the handler. */
  method: string;
}

const project = (path: string): string => `/projects/${PROJECT_ID}/${path}`;
const issue = (path: string): string => `/projects/${PROJECT_ID}/issues/${ISSUE_ID}/${path}`;

const MATRIX: MatrixRow[] = [
  { service: 'projects', path: '/projects/mine.json', body: {}, invalidBody: { page: 'x' }, success: 200, method: 'list' },
  { service: 'projects', path: '/projects/create.json', body: { name: 'Roadmap' }, invalidBody: { name: 5 }, success: 201, method: 'create' },
  { service: 'projects', path: '/projects/from-repository.json', body: { repository: { githubId: 1 } }, invalidBody: { repository: 5 }, success: 201, method: 'create' },
  { service: 'projects', path: project('show.json'), body: {}, invalidBody: null, success: 200, method: 'show' },
  { service: 'projects', path: project('edit.json'), body: { name: 'New' }, invalidBody: { name: 5 }, success: 200, method: 'edit' },
  { service: 'projects', path: project('repository.json'), body: { repository: null }, invalidBody: { repository: 5 }, success: 200, method: 'setRepository' },
  { service: 'projects', path: project('delete.json'), body: {}, invalidBody: null, success: 200, method: 'delete' },
  { service: 'issues', path: project('issues.json'), body: {}, invalidBody: { page: 'x' }, success: 200, method: 'list' },
  { service: 'issues', path: project('issues/create.json'), body: { title: 'Fix it' }, invalidBody: { title: 5 }, success: 201, method: 'create' },
  { service: 'issues', path: issue('show.json'), body: {}, invalidBody: null, success: 200, method: 'show' },
  { service: 'issues', path: issue('edit.json'), body: { title: 'New' }, invalidBody: { title: 5 }, success: 200, method: 'edit' },
  { service: 'issues', path: issue('delete.json'), body: {}, invalidBody: null, success: 200, method: 'delete' },
  { service: 'links', path: project('issues/import.json'), body: { number: 12 }, invalidBody: { number: 'x' }, success: 201, method: 'import' },
  { service: 'links', path: issue('attach.json'), body: { number: 12 }, invalidBody: { number: 'x' }, success: 200, method: 'attach' },
  { service: 'links', path: issue('unlink.json'), body: {}, invalidBody: { discardUnsentChanges: 'x' }, success: 200, method: 'unlink' },
  { service: 'links', path: issue('refresh.json'), body: {}, invalidBody: null, success: 202, method: 'refreshIssue' },
  { service: 'links', path: project('refresh.json'), body: {}, invalidBody: null, success: 202, method: 'refreshProject' },
  { service: 'links', path: issue('retry-sync.json'), body: {}, invalidBody: null, success: 202, method: 'retrySync' },
];

const withIssueId = MATRIX.filter((row) => row.path.includes(ISSUE_ID));
const withProjectId = MATRIX.filter((row) => row.path.includes(PROJECT_ID));

/** The fakes' shared surface the matrix uses. */
interface RecordingFake {
  calls: Array<{ method: string; userId: number; args: unknown[] }>;
  failWith(method: never, error: Error): unknown;
}

describe('Issues routes access matrix (e2e)', () => {
  const { ctx } = useIssuesTestApp();

  const fake = (row: MatrixRow): RecordingFake => ctx[row.service] as unknown as RecordingFake;
  const fail = (row: MatrixRow, error: Error): void => {
    fake(row).failWith(row.method as never, error);
  };
  const send = (row: MatrixRow, cookie?: string, body: Record<string, unknown> = row.body): request.Test => call(ctx.app, 'post', row.path, cookie).send(body);
  const allCalls = () => [...ctx.projects.calls, ...ctx.issues.calls, ...ctx.links.calls];

  it('has a row for every route the Issues module registers (completeness)', () => {
    expect(registeredRoutes()).toEqual(MATRIX.map((row) => `POST ${row.path}`).sort());
  });

  describe.each(MATRIX.map((row) => [`POST ${row.path}`, row] as const))('%s', (_name, row) => {
    it('answers 401 without a session, before any service call', async () => {
      expectErrorBody(await send(row), { status: 401, code: ErrorCodes.UNAUTHORIZED });
      expect(allCalls()).toEqual([]);
    });

    it('answers 403 to a foreign Origin, even with the session cookie', async () => {
      const response = await send(row, ctx.owner).set(CROSS_SITE);

      expectErrorBody(response, { status: 403, code: ErrorCodes.FORBIDDEN });
      expect(allCalls()).toEqual([]);
    });

    it('answers its documented status with X-Skip-Cache and Cache-Control: no-store on a success', async () => {
      const response = await send(row, ctx.owner);

      expect(response.status).toBe(row.success);
      expectNeverCached(response);
    });

    it('sends X-Skip-Cache and Cache-Control: no-store on a handler error', async () => {
      fail(row, projectNotFound());

      const response = await send(row, ctx.owner);

      expectErrorBody(response, { status: 404, code: ErrorCodes.NOT_FOUND, message: 'Project not found' });
      expectNeverCached(response);
    });

    it('sends X-Skip-Cache and Cache-Control: no-store on a validation error', async () => {
      // A route with a DTO is sent a body it rejects; the others a malformed id (all but the three project-less routes take one).
      const response = row.invalidBody
        ? await send(row, ctx.owner, row.invalidBody)
        : await call(ctx.app, 'post', row.path.replace(PROJECT_ID, 'not-a-uuid'), ctx.owner).send(row.body);

      expect(response.status).toBe(400);
      expect(response.body.error.code).toBe(ErrorCodes.VALIDATION_FAILED);
      expectNeverCached(response);
      expect(allCalls()).toEqual([]);
    });

    it('never answers GET', async () => {
      const response = await call(ctx.app, 'get', row.path, ctx.owner);

      expect(response.status).toBe(404);
      expect(allCalls()).toEqual([]);
    });

    it('scopes the call to the session\'s user, never to a body field', async () => {
      await send(row, ctx.intruder, { ...row.body, userId: ctx.ids.owner, user_id: ctx.ids.owner });

      expect(fake(row).calls).toHaveLength(1);
      expect(fake(row).calls[0].userId).toBe(ctx.ids.intruder);
      expect(JSON.stringify(fake(row).calls[0].args)).not.toMatch(/user_?id/i);
    });

    it('gives an admin session no access: the call reaches the service as the admin\'s own user, which answers the same 404', async () => {
      fail(row, projectNotFound());
      const asAdmin = await send(row, ctx.admin);

      fail(row, projectNotFound());
      const asOwner = await send(row, ctx.owner);

      expectErrorBody(asAdmin, { status: 404, code: ErrorCodes.NOT_FOUND, message: 'Project not found' });
      expect(withoutTimestamp(asAdmin.body)).toEqual(withoutTimestamp(asOwner.body));
      expect(fake(row).calls[0].userId).toBe(ctx.ids.admin);
      expect(JSON.stringify(fake(row).calls[0].args)).not.toMatch(/admin/i);
    });
  });

  describe.each(withProjectId.map((row) => [`POST ${row.path}`, row] as const))('%s: path ids', (_name, row) => {
    it('answers 400 VALIDATION_FAILED for a malformed :projectId, before any service call', async () => {
      const response = await call(ctx.app, 'post', row.path.replace(PROJECT_ID, 'not-a-uuid'), ctx.owner).send(row.body);

      expect(response.status).toBe(400);
      expect(response.body.error.code).toBe(ErrorCodes.VALIDATION_FAILED);
      expect(allCalls()).toEqual([]);
    });
  });

  describe.each(withIssueId.map((row) => [`POST ${row.path}`, row] as const))('%s: issue id', (_name, row) => {
    it('answers 400 VALIDATION_FAILED for a malformed :issueId, before any service call', async () => {
      const response = await call(ctx.app, 'post', row.path.replace(ISSUE_ID, 'not-a-uuid'), ctx.owner).send(row.body);

      expect(response.status).toBe(400);
      expect(response.body.error.code).toBe(ErrorCodes.VALIDATION_FAILED);
      expect(allCalls()).toEqual([]);
    });
  });

  describe('what a route answers for an id that is not the caller\'s', () => {
    it.each(withProjectId.map((row) => [`POST ${row.path}`, row] as const))('answers the identical project 404 whoever asks: %s', async (_name, row) => {
      fail(row, projectNotFound());
      const first = await send(row, ctx.owner);

      fail(row, projectNotFound());
      const second = await send(row, ctx.intruder);

      expect(first.status).toBe(404);
      expect(withoutTimestamp(first.body)).toEqual(withoutTimestamp(second.body));
    });

    it.each(withIssueId.map((row) => [`POST ${row.path}`, row] as const))('answers the identical issue 404 whoever asks: %s', async (_name, row) => {
      fail(row, issueNotFound());
      const first = await send(row, ctx.owner);

      fail(row, issueNotFound());
      const second = await send(row, ctx.intruder);

      expectErrorBody(first, { status: 404, code: ErrorCodes.NOT_FOUND, message: 'Issue not found' });
      expect(withoutTimestamp(first.body)).toEqual(withoutTimestamp(second.body));
    });
  });

  describe('the bodies', () => {
    it('never leaks an internal id, the owner, a repository id or a project_id in any success body', async () => {
      ctx.projects.project = sampleProject();
      ctx.issues.issue = sampleIssue();
      ctx.links.issue = sampleIssue();

      for (const row of MATRIX) expectNoForbiddenKeys((await send(row, ctx.owner).expect(row.success)).body);
    });

    it('routes the static create and import paths to their own handlers, never to a show or edit handler', async () => {
      await send(MATRIX[8], ctx.owner).expect(201);
      await send(MATRIX[12], ctx.owner).expect(201);

      expect(ctx.issues.calls.map((entry) => entry.method)).toEqual(['create']);
      expect(ctx.links.calls.map((entry) => entry.method)).toEqual(['import']);
    });
  });
});
