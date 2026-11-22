import 'reflect-metadata';
import { RequestMethod } from '@nestjs/common';
import { METHOD_METADATA, PATH_METADATA } from '@nestjs/common/constants.js';
import type request from 'supertest';
import { expectErrorBody } from '../../auth/tests/support/error-body.js';
import { ErrorCodes } from '../../core/error-codes.js';
import { githubRateLimited } from '../../core/github-http-errors.js';
import { IssueLinksController } from '../issue-links.controller.js';
import {
  issueLinkGone,
  issueNotFound,
  issueNotLinked,
  projectHasNoRepository,
  projectNotFound,
  projectRepositoryUnavailable,
} from '../issues-http-errors.js';
import {
  call,
  expectNeverCached,
  expectNoForbiddenKeys,
  type IssuesTestContext,
  useIssuesTestApp,
  withoutTimestamp,
} from './support/build-issues-test-app.js';
import type { IssueLinksServiceSurface } from './support/fake-issue-links.service.js';
import { sampleIssue } from './support/fake-issues.service.js';

const CROSS_SITE = { 'Sec-Fetch-Site': 'cross-site', Origin: 'https://evil.example' };
const PROJECT_ID = '3f2a0000-0000-4000-8000-0000000000c9';
const ISSUE_ID = '3f2a0000-0000-4000-8000-0000000000d1';

/** One row of the link route access matrix. */
interface MatrixRow {
  path: string;
  /** A body the route accepts. */
  body: Record<string, unknown>;
  success: number;
  /** The service method behind the route, to make it fail inside the handler. */
  method: keyof IssueLinksServiceSurface;
  /** Whether the route reads a body DTO (the trigger routes read none, so a bad body is ignored). */
  validatesBody: boolean;
}

const MATRIX: MatrixRow[] = [
  { path: `/projects/${PROJECT_ID}/issues/import.json`, body: { number: 12 }, success: 201, method: 'import', validatesBody: true },
  { path: `/projects/${PROJECT_ID}/issues/${ISSUE_ID}/attach.json`, body: { number: 12 }, success: 200, method: 'attach', validatesBody: true },
  { path: `/projects/${PROJECT_ID}/issues/${ISSUE_ID}/unlink.json`, body: {}, success: 200, method: 'unlink', validatesBody: true },
  { path: `/projects/${PROJECT_ID}/issues/${ISSUE_ID}/refresh.json`, body: {}, success: 202, method: 'refreshIssue', validatesBody: false },
  { path: `/projects/${PROJECT_ID}/refresh.json`, body: {}, success: 202, method: 'refreshProject', validatesBody: false },
  { path: `/projects/${PROJECT_ID}/issues/${ISSUE_ID}/retry-sync.json`, body: {}, success: 202, method: 'retrySync', validatesBody: false },
];

function send(ctx: IssuesTestContext, row: MatrixRow, cookie?: string, body = row.body): request.Test {
  return call(ctx.app, 'post', row.path, cookie).send(body);
}

/**
 * Every route of `IssueLinksController`, from Nest's decorator metadata.
 * @returns {string[]} `METHOD /path` entries (the path ids replaced by the sample uuids).
 */
function registeredRoutes(): string[] {
  const prototype = IssueLinksController.prototype as unknown as Record<string, object>;

  return Object.getOwnPropertyNames(prototype)
    .filter((name) => name !== 'constructor')
    .filter((name) => Reflect.getMetadata(PATH_METADATA, prototype[name]) !== undefined)
    .map((name) => {
      const method = RequestMethod[Reflect.getMetadata(METHOD_METADATA, prototype[name]) as number];
      const path = (Reflect.getMetadata(PATH_METADATA, prototype[name]) as string)
        .replace(':projectId', PROJECT_ID)
        .replace(':issueId', ISSUE_ID);

      return `${method} /${path}`;
    });
}

describe('IssueLinksController access rules (e2e)', () => {
  const { ctx } = useIssuesTestApp();

  it('covers every route registered on IssueLinksController (completeness)', () => {
    expect(registeredRoutes().sort()).toEqual(MATRIX.map((row) => `POST ${row.path}`).sort());
  });

  describe.each(MATRIX.map((row) => [`POST ${row.path}`, row]))('%s', (_name, row) => {
    it('answers 401 without a session, before any service call', async () => {
      expectErrorBody(await send(ctx, row), { status: 401, code: ErrorCodes.UNAUTHORIZED });
      expect(ctx.links.calls).toEqual([]);
    });

    it('answers 403 to a foreign Origin, even with the session cookie', async () => {
      const response = await send(ctx, row, ctx.owner).set(CROSS_SITE);

      expectErrorBody(response, { status: 403, code: ErrorCodes.FORBIDDEN });
      expect(ctx.links.calls).toEqual([]);
    });

    it('answers its documented status and sends X-Skip-Cache and Cache-Control: no-store', async () => {
      const response = await send(ctx, row, ctx.owner);

      expect(response.status).toBe(row.success);
      expectNeverCached(response);
    });

    it('sends the no-store headers on a handler error', async () => {
      ctx.links.failWith(row.method, projectNotFound());

      const response = await send(ctx, row, ctx.owner);

      expectErrorBody(response, { status: 404, code: ErrorCodes.NOT_FOUND, message: 'Project not found' });
      expectNeverCached(response);
    });

    (row.validatesBody ? it : it.skip)('sends the no-store headers on a validation error', async () => {
      const response = await send(ctx, row, ctx.owner, { number: 'x', discardUnsentChanges: 'x' });

      expect(response.status).toBe(400);
      expectNeverCached(response);
      expect(ctx.links.calls).toEqual([]);
    });

    it('never answers GET', async () => {
      const response = await call(ctx.app, 'get', row.path, ctx.owner);

      expect(response.status).toBe(404);
      expect(ctx.links.calls).toEqual([]);
    });

    it('scopes the call to the session\'s user, never to a body field', async () => {
      await send(ctx, row, ctx.intruder, { ...row.body, userId: ctx.ids.owner, user_id: ctx.ids.owner });

      expect(ctx.links.calls).toHaveLength(1);
      expect(ctx.links.calls[0].userId).toBe(ctx.ids.intruder);
      expect(JSON.stringify(ctx.links.calls[0].args)).not.toMatch(/user_?id/i);
    });

    it('answers 400 for a non-uuid :projectId, before any service call', async () => {
      const response = await call(ctx.app, 'post', row.path.replace(PROJECT_ID, 'not-a-uuid'), ctx.owner).send(row.body);

      expect(response.status).toBe(400);
      expect(response.body.error.code).toBe(ErrorCodes.VALIDATION_FAILED);
      expect(ctx.links.calls).toEqual([]);
    });
  });

  it.each(['attach', 'unlink', 'refresh', 'retry-sync'])('answers 400 for a non-uuid :issueId on %s.json, before any service call', async (action) => {
    const response = await call(ctx.app, 'post', `/projects/${PROJECT_ID}/issues/not-a-uuid/${action}.json`, ctx.owner).send({ number: 1 });

    expect(response.status).toBe(400);
    expect(response.body.error.code).toBe(ErrorCodes.VALIDATION_FAILED);
    expect(ctx.links.calls).toEqual([]);
  });

  it('routes import.json to import, never to a show or edit handler', async () => {
    await send(ctx, MATRIX[0], ctx.owner).expect(201);

    expect(ctx.links.calls.map((entry) => entry.method)).toEqual(['import']);
    expect(ctx.issues.calls).toEqual([]);
  });

  it('answers every project 404 with the identical body, whoever asks', async () => {
    ctx.links.failWith('import', projectNotFound());
    const first = await send(ctx, MATRIX[0], ctx.owner);
    ctx.links.failWith('import', projectNotFound());
    const second = await send(ctx, MATRIX[0], ctx.intruder);

    expect(first.status).toBe(404);
    expect(withoutTimestamp(first.body)).toEqual(withoutTimestamp(second.body));
  });

  it('answers every issue 404 with the identical body, whoever asks', async () => {
    ctx.links.failWith('attach', issueNotFound());
    const first = await send(ctx, MATRIX[1], ctx.owner);
    ctx.links.failWith('attach', issueNotFound());
    const second = await send(ctx, MATRIX[1], ctx.intruder);

    expectErrorBody(first, { status: 404, code: ErrorCodes.NOT_FOUND, message: 'Issue not found' });
    expect(withoutTimestamp(first.body)).toEqual(withoutTimestamp(second.body));
  });

  it('passes a service HttpException through with its code and no-store headers', async () => {
    ctx.links.failWith('import', githubRateLimited(30));

    const response = await send(ctx, MATRIX[0], ctx.owner);

    expect(response.status).toBe(503);
    expect(response.body.error.code).toBe(ErrorCodes.GITHUB_RATE_LIMITED);
    expectNeverCached(response);
  });

  it('never leaks an internal id or project_id in a link response body', async () => {
    ctx.links.issue = sampleIssue();

    expectNoForbiddenKeys((await send(ctx, MATRIX[0], ctx.owner).expect(201)).body);
    expectNoForbiddenKeys((await send(ctx, MATRIX[1], ctx.owner).expect(200)).body);
    expectNoForbiddenKeys((await send(ctx, MATRIX[2], ctx.owner).expect(200)).body);
    expectNoForbiddenKeys((await send(ctx, MATRIX[3], ctx.owner).expect(202)).body);
    expectNoForbiddenKeys((await send(ctx, MATRIX[4], ctx.owner).expect(202)).body);
    expectNoForbiddenKeys((await send(ctx, MATRIX[5], ctx.owner).expect(202)).body);
  });

  describe('the sync trigger routes', () => {
    it('T2 answers 202 { issue, alreadyFresh: false } when enqueued, and 200 { issue, alreadyFresh: true } when skipped', async () => {
      const enqueued = await send(ctx, MATRIX[3], ctx.owner).expect(202);

      expect(enqueued.body).toEqual({ issue: ctx.links.issue, alreadyFresh: false });

      ctx.links.triggerStatus = 200;

      const skipped = await send(ctx, MATRIX[3], ctx.owner).expect(200);

      expect(skipped.body).toEqual({ issue: ctx.links.issue, alreadyFresh: true });
      expect(ctx.links.callsOf('refreshIssue').map((entry) => entry.args)).toEqual([[PROJECT_ID, ISSUE_ID], [PROJECT_ID, ISSUE_ID]]);
    });

    it('T3 answers 202 { enqueued, skippedFresh }, with the project only', async () => {
      const response = await send(ctx, MATRIX[4], ctx.owner).expect(202);

      expect(response.body).toEqual({ enqueued: 2, skippedFresh: 1 });
      expect(ctx.links.callsOf('refreshProject').map((entry) => entry.args)).toEqual([[PROJECT_ID]]);
    });

    it('T4 answers 202 { issue } when reset and enqueued, and 200 { issue } for a no-op', async () => {
      expect((await send(ctx, MATRIX[5], ctx.owner).expect(202)).body).toEqual({ issue: ctx.links.issue });

      ctx.links.triggerStatus = 200;

      expect((await send(ctx, MATRIX[5], ctx.owner).expect(200)).body).toEqual({ issue: ctx.links.issue });
    });

    it.each([
      ['refreshIssue', 3, issueLinkGone()],
      ['retrySync', 5, issueNotLinked()],
      ['refreshProject', 4, projectHasNoRepository()],
      ['retrySync', 5, projectRepositoryUnavailable()],
    ] as const)('passes the %s refusal through with its code and no-store headers', async (method, index, error) => {
      ctx.links.failWith(method, error);

      const response = await send(ctx, MATRIX[index], ctx.owner);

      expect(response.status).toBe(409);
      expect(response.body.error.code).toBe((error.getResponse() as { code: string }).code);
      expectNeverCached(response);
    });
  });
});
