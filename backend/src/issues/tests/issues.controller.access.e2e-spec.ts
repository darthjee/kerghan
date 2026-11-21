import 'reflect-metadata';
import { RequestMethod } from '@nestjs/common';
import { METHOD_METADATA, PATH_METADATA } from '@nestjs/common/constants.js';
import type request from 'supertest';
import { expectErrorBody } from '../../auth/tests/support/error-body.js';
import { ErrorCodes } from '../../core/error-codes.js';
import { issueNotFound, projectNotFound } from '../issues-http-errors.js';
import { IssuesController } from '../issues.controller.js';
import {
  call,
  expectNeverCached,
  expectNoForbiddenKeys,
  type IssuesTestContext,
  useIssuesTestApp,
  withoutTimestamp,
} from './support/build-issues-test-app.js';
import { sampleIssue, type IssuesServiceSurface } from './support/fake-issues.service.js';

const CROSS_SITE = { 'Sec-Fetch-Site': 'cross-site', Origin: 'https://evil.example' };
const PROJECT_ID = '3f2a0000-0000-4000-8000-0000000000c9';
const ISSUE_ID = '3f2a0000-0000-4000-8000-0000000000d1';

/** One row of the Issues route access matrix. */
interface MatrixRow {
  path: string;
  /** A body the route accepts. */
  body: Record<string, unknown>;
  success: number;
  /** The service method behind the route, to make it fail inside the handler. */
  method: keyof IssuesServiceSurface;
}

const MATRIX: MatrixRow[] = [
  { path: `/projects/${PROJECT_ID}/issues.json`, body: {}, success: 200, method: 'list' },
  { path: `/projects/${PROJECT_ID}/issues/create.json`, body: { title: 'Fix it' }, success: 201, method: 'create' },
  { path: `/projects/${PROJECT_ID}/issues/${ISSUE_ID}/show.json`, body: {}, success: 200, method: 'show' },
  { path: `/projects/${PROJECT_ID}/issues/${ISSUE_ID}/edit.json`, body: { title: 'New' }, success: 200, method: 'edit' },
  { path: `/projects/${PROJECT_ID}/issues/${ISSUE_ID}/delete.json`, body: {}, success: 200, method: 'delete' },
];

function send(ctx: IssuesTestContext, row: MatrixRow, cookie?: string, body = row.body): request.Test {
  return call(ctx.app, 'post', row.path, cookie).send(body);
}

/**
 * Every route of `IssuesController`, from Nest's decorator metadata.
 * @returns {string[]} `METHOD /path` entries (the path ids replaced by the sample uuids).
 */
function registeredRoutes(): string[] {
  const prototype = IssuesController.prototype as unknown as Record<string, object>;

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

describe('IssuesController access rules (e2e)', () => {
  const { ctx } = useIssuesTestApp();

  it('covers every route registered on IssuesController (completeness)', () => {
    expect(registeredRoutes().sort()).toEqual(MATRIX.map((row) => `POST ${row.path}`).sort());
  });

  describe.each(MATRIX.map((row) => [`POST ${row.path}`, row]))('%s', (_name, row) => {
    it('answers 401 without a session, before any service call', async () => {
      expectErrorBody(await send(ctx, row), { status: 401, code: ErrorCodes.UNAUTHORIZED });
      expect(ctx.issues.calls).toEqual([]);
    });

    it('answers 403 to a foreign Origin, even with the session cookie', async () => {
      const response = await send(ctx, row, ctx.owner).set(CROSS_SITE);

      expectErrorBody(response, { status: 403, code: ErrorCodes.FORBIDDEN });
      expect(ctx.issues.calls).toEqual([]);
    });

    it('sends X-Skip-Cache and Cache-Control: no-store on a success', async () => {
      const response = await send(ctx, row, ctx.owner);

      expect(response.status).toBe(row.success);
      expectNeverCached(response);
    });

    it('sends X-Skip-Cache and Cache-Control: no-store on a handler error', async () => {
      ctx.issues.failWith(row.method, projectNotFound());

      const response = await send(ctx, row, ctx.owner);

      expectErrorBody(response, { status: 404, code: ErrorCodes.NOT_FOUND, message: 'Project not found' });
      expectNeverCached(response);
    });

    it('sends X-Skip-Cache and Cache-Control: no-store on a validation error', async () => {
      const response = await send(ctx, row, ctx.owner, { page: 'x', perPage: 'x', title: 5, body: 5, state: 'x' });

      if (response.status === 400) expectNeverCached(response);
    });

    it('never answers GET', async () => {
      const response = await call(ctx.app, 'get', row.path, ctx.owner);

      expect(response.status).toBe(404);
      expect(ctx.issues.calls).toEqual([]);
    });

    it('scopes the call to the session\'s user, never to a body field', async () => {
      await send(ctx, row, ctx.intruder, { ...row.body, userId: ctx.ids.owner, user_id: ctx.ids.owner });

      expect(ctx.issues.calls).toHaveLength(1);
      expect(ctx.issues.calls[0].userId).toBe(ctx.ids.intruder);
      expect(JSON.stringify(ctx.issues.calls[0].args)).not.toMatch(/user_?id/i);
    });
  });

  it.each(['issues.json', 'issues/create.json', `issues/${ISSUE_ID}/show.json`, `issues/${ISSUE_ID}/edit.json`, `issues/${ISSUE_ID}/delete.json`])(
    'answers 400 for a non-uuid :projectId on %s, before any service call',
    async (tail) => {
      const response = await call(ctx.app, 'post', `/projects/not-a-uuid/${tail}`, ctx.owner).send({ title: 'x' });

      expect(response.status).toBe(400);
      expect(response.body.error.code).toBe(ErrorCodes.VALIDATION_FAILED);
      expect(ctx.issues.calls).toEqual([]);
    },
  );

  it.each(['show', 'edit', 'delete'])('answers 400 for a non-uuid :issueId on %s.json, before any service call', async (action) => {
    const response = await call(ctx.app, 'post', `/projects/${PROJECT_ID}/issues/not-a-uuid/${action}.json`, ctx.owner).send({});

    expect(response.status).toBe(400);
    expect(response.body.error.code).toBe(ErrorCodes.VALIDATION_FAILED);
    expect(ctx.issues.calls).toEqual([]);
  });

  it('routes create.json to create, never to a show or edit handler', async () => {
    await send(ctx, MATRIX[1], ctx.owner).expect(201);

    expect(ctx.issues.calls.map((entry) => entry.method)).toEqual(['create']);
  });

  it('answers every project 404 with the identical body, whoever asks', async () => {
    ctx.issues.failWith('show', projectNotFound());
    const first = await send(ctx, MATRIX[2], ctx.owner);
    ctx.issues.failWith('show', projectNotFound());
    const second = await send(ctx, MATRIX[2], ctx.intruder);

    expect(first.status).toBe(404);
    expect(withoutTimestamp(first.body)).toEqual(withoutTimestamp(second.body));
  });

  it('answers every issue 404 with the identical body, whoever asks', async () => {
    ctx.issues.failWith('show', issueNotFound());
    const first = await send(ctx, MATRIX[2], ctx.owner);
    ctx.issues.failWith('show', issueNotFound());
    const second = await send(ctx, MATRIX[2], ctx.intruder);

    expectErrorBody(first, { status: 404, code: ErrorCodes.NOT_FOUND, message: 'Issue not found' });
    expect(withoutTimestamp(first.body)).toEqual(withoutTimestamp(second.body));
  });

  it('never leaks an internal id or project_id in an issue body', async () => {
    ctx.issues.issue = sampleIssue();
    const response = await send(ctx, MATRIX[2], ctx.owner).expect(200);

    expectNoForbiddenKeys(response.body);
  });
});
