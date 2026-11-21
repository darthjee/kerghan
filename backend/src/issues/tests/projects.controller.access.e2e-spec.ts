import 'reflect-metadata';
import { RequestMethod } from '@nestjs/common';
import { METHOD_METADATA, PATH_METADATA } from '@nestjs/common/constants.js';
import type request from 'supertest';
import { expectErrorBody } from '../../auth/tests/support/error-body.js';
import { ErrorCodes } from '../../core/error-codes.js';
import { projectNotFound } from '../issues-http-errors.js';
import { ProjectsController } from '../projects.controller.js';
import {
  call,
  expectNeverCached,
  expectNoForbiddenKeys,
  type IssuesTestContext,
  useIssuesTestApp,
  withoutTimestamp,
} from './support/build-issues-test-app.js';
import { sampleProject, type ProjectsServiceSurface } from './support/fake-projects.service.js';

const CROSS_SITE = { 'Sec-Fetch-Site': 'cross-site', Origin: 'https://evil.example' };
const PROJECT_ID = '3f2a0000-0000-4000-8000-0000000000c9';

/** One row of the route access matrix (extended to every Issues route by #559). */
interface MatrixRow {
  path: string;
  /** A body the route accepts. */
  body: Record<string, unknown>;
  success: number;
  /** The service method behind the route, to make it fail inside the handler. */
  method: keyof ProjectsServiceSurface;
}

const MATRIX: MatrixRow[] = [
  { path: '/projects/mine.json', body: {}, success: 200, method: 'list' },
  { path: '/projects/create.json', body: { name: 'Roadmap' }, success: 201, method: 'create' },
  { path: '/projects/from-repository.json', body: { repository: { githubId: 1 } }, success: 201, method: 'create' },
  { path: `/projects/${PROJECT_ID}/show.json`, body: {}, success: 200, method: 'show' },
  { path: `/projects/${PROJECT_ID}/edit.json`, body: { name: 'New' }, success: 200, method: 'edit' },
  { path: `/projects/${PROJECT_ID}/repository.json`, body: { repository: null }, success: 200, method: 'setRepository' },
  { path: `/projects/${PROJECT_ID}/delete.json`, body: {}, success: 200, method: 'delete' },
];

function send(ctx: IssuesTestContext, row: MatrixRow, cookie?: string, body = row.body): request.Test {
  return call(ctx.app, 'post', row.path, cookie).send(body);
}

/**
 * Every route of `ProjectsController`, from Nest's decorator metadata.
 * @returns {string[]} `METHOD /path` entries (the path id replaced by the sample uuid).
 */
function registeredRoutes(): string[] {
  const prototype = ProjectsController.prototype as unknown as Record<string, object>;

  return Object.getOwnPropertyNames(prototype)
    .filter((name) => name !== 'constructor')
    .filter((name) => Reflect.getMetadata(PATH_METADATA, prototype[name]) !== undefined)
    .map((name) => {
      const method = RequestMethod[Reflect.getMetadata(METHOD_METADATA, prototype[name]) as number];
      const path = (Reflect.getMetadata(PATH_METADATA, prototype[name]) as string).replace(':projectId', PROJECT_ID);

      return `${method} /${path}`;
    });
}

describe('ProjectsController access rules (e2e)', () => {
  const { ctx } = useIssuesTestApp();

  it('covers every route registered on ProjectsController (completeness)', () => {
    expect(registeredRoutes().sort()).toEqual(MATRIX.map((row) => `POST ${row.path}`).sort());
  });

  describe.each(MATRIX.map((row) => [`POST ${row.path}`, row]))('%s', (_name, row) => {
    it('answers 401 without a session, before any service call', async () => {
      expectErrorBody(await send(ctx, row), { status: 401, code: ErrorCodes.UNAUTHORIZED });
      expect(ctx.projects.calls).toEqual([]);
    });

    it('answers 403 to a foreign Origin, even with the session cookie', async () => {
      const response = await send(ctx, row, ctx.owner).set(CROSS_SITE);

      expectErrorBody(response, { status: 403, code: ErrorCodes.FORBIDDEN });
      expect(ctx.projects.calls).toEqual([]);
    });

    it('sends X-Skip-Cache and Cache-Control: no-store on a success', async () => {
      const response = await send(ctx, row, ctx.owner);

      expect(response.status).toBe(row.success);
      expectNeverCached(response);
    });

    it('sends X-Skip-Cache and Cache-Control: no-store on a handler error', async () => {
      ctx.projects.failWith(row.method, projectNotFound());

      const response = await send(ctx, row, ctx.owner);

      expectErrorBody(response, { status: 404, code: ErrorCodes.NOT_FOUND, message: 'Project not found' });
      expectNeverCached(response);
    });

    it('sends X-Skip-Cache and Cache-Control: no-store on a validation error', async () => {
      const response = await send(ctx, row, ctx.owner, { page: 'x', perPage: 'x', name: 5, repository: 5, description: 5 });

      if (response.status === 400) expectNeverCached(response);
    });

    it('never answers GET', async () => {
      const response = await call(ctx.app, 'get', row.path, ctx.owner);

      expect(response.status).toBe(404);
      expect(ctx.projects.calls).toEqual([]);
    });

    it('scopes the call to the session\'s user, never to a body field', async () => {
      await send(ctx, row, ctx.intruder, { ...row.body, userId: ctx.ids.owner, user_id: ctx.ids.owner });

      expect(ctx.projects.calls).toHaveLength(1);
      expect(ctx.projects.calls[0].userId).toBe(ctx.ids.intruder);
      expect(JSON.stringify(ctx.projects.calls[0].args)).not.toMatch(/user_?id/i);
    });
  });

  it('answers every project 404 with the identical body, whoever asks', async () => {
    const row = MATRIX[3];

    ctx.projects.failWith('show', projectNotFound());
    const first = await send(ctx, row, ctx.owner);
    ctx.projects.failWith('show', projectNotFound());
    const second = await send(ctx, row, ctx.intruder);

    expect(first.status).toBe(404);
    expect(withoutTimestamp(first.body)).toEqual(withoutTimestamp(second.body));
  });

  it('never leaks an internal id, the owner or a repository id in a project body', async () => {
    ctx.projects.project = sampleProject();
    const response = await send(ctx, MATRIX[3], ctx.owner).expect(200);

    expectNoForbiddenKeys(response.body);
  });
});
