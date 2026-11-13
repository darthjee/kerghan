import 'reflect-metadata';
import { RequestMethod } from '@nestjs/common';
import { METHOD_METADATA, PATH_METADATA } from '@nestjs/common/constants.js';
import request from 'supertest';
import {
  call,
  expectNeverCached,
  expectNoForbiddenKeys,
  INTRUDER_ONLY_GITHUB_ID,
  MISSING_GITHUB_ID,
  type RepositoriesTestContext,
  SHARED_GITHUB_ID,
  useRepositoriesTestApp,
  withoutTimestamp,
} from './support/build-repositories-test-app.js';
import { expectErrorBody } from '../../auth/tests/support/error-body.js';
import { ErrorCodes } from '../../core/error-codes.js';
import { RepositoriesController } from '../repositories.controller.js';

const CROSS_SITE = { 'Sec-Fetch-Site': 'cross-site', Origin: 'https://evil.example' };

type Method = 'post' | 'patch';

/** One row of the route access matrix (`security.md#required-tests`). */
interface MatrixRow {
  method: Method;
  path: string;
  /** A body the route accepts. */
  body: Record<string, unknown>;
  success: number;
  /** Makes the route fail inside the handler (after the interceptor), as the owner. */
  handlerError: (ctx: RepositoriesTestContext) => { body: Record<string, unknown>; status: number };
}

const MATRIX: MatrixRow[] = [
  {
    method: 'post', path: '/repositories/mine.json', body: {}, success: 200,
    handlerError: () => ({ body: { perPage: 101 }, status: 400 }),
  },
  {
    method: 'post', path: '/repositories/sync/state.json', body: {}, success: 200,
    handlerError: (ctx) => {
      ctx.repositories.markNoUser(ctx.ids.owner);
      return { body: {}, status: 401 };
    },
  },
  {
    method: 'post', path: '/repositories/sync.json', body: {}, success: 202,
    handlerError: (ctx) => {
      ctx.repositories.setRefresh(ctx.ids.owner, {
        kind: 'cooldown', lastStartedAt: ctx.clock.now(), refreshAvailableAt: new Date(ctx.clock.now().getTime() + 60_000),
      });
      return { body: {}, status: 429 };
    },
  },
  {
    method: 'post', path: '/repositories/add.json', body: { githubId: SHARED_GITHUB_ID }, success: 200,
    handlerError: () => ({ body: { githubId: MISSING_GITHUB_ID }, status: 404 }),
  },
  {
    method: 'post', path: '/auth/account/mine.json', body: {}, success: 201,
    handlerError: () => ({ body: {}, status: 0 }),
  },
  {
    method: 'patch', path: '/auth/account.json', body: { githubHandle: 'darthjee' }, success: 200,
    handlerError: () => ({ body: { githubHandle: '-bad-' }, status: 400 }),
  },
];

const REPOSITORY_ROWS = MATRIX.filter((row) => row.path.startsWith('/repositories/'));

function send(ctx: RepositoriesTestContext, row: MatrixRow, cookie?: string, body = row.body): request.Test {
  return call(ctx.app, row.method, row.path, cookie).send(body);
}

/**
 * Every route of `RepositoriesController`, from Nest's decorator metadata.
 * @returns {string[]} `METHOD /path` entries.
 */
function registeredRoutes(): string[] {
  const prototype = RepositoriesController.prototype as unknown as Record<string, object>;

  return Object.getOwnPropertyNames(prototype)
    .filter((name) => name !== 'constructor')
    .filter((name) => Reflect.getMetadata(PATH_METADATA, prototype[name]) !== undefined)
    .map((name) => {
      const method = RequestMethod[Reflect.getMetadata(METHOD_METADATA, prototype[name]) as number];

      return `${method} /${Reflect.getMetadata(PATH_METADATA, prototype[name]) as string}`;
    });
}

describe('RepositoriesController access rules (e2e)', () => {
  const { ctx } = useRepositoriesTestApp();

  beforeEach(() => {
    ctx.github.script(null, 'getRepository', '*', { kind: 'not_found' });
  });

  it('covers every route registered on RepositoriesController (completeness)', () => {
    const inMatrix = REPOSITORY_ROWS.map((row) => `${row.method.toUpperCase()} ${row.path}`);

    expect(registeredRoutes().sort()).toEqual(inMatrix.sort());
  });

  describe.each(MATRIX.map((row) => [`${row.method.toUpperCase()} ${row.path}`, row]))('%s', (_name, row) => {
    it('answers 401 without a session', async () => {
      expectErrorBody(await send(ctx, row), { status: 401, code: ErrorCodes.UNAUTHORIZED });
    });

    it('answers 403 to a foreign Origin, even with the session cookie', async () => {
      const response = await send(ctx, row, ctx.owner).set(CROSS_SITE);

      expectErrorBody(response, { status: 403, code: ErrorCodes.FORBIDDEN });
      expect(ctx.github.githubCalls()).toEqual([]);
    });

    it('sends X-Skip-Cache and Cache-Control: no-store on a success', async () => {
      if (row.path === '/repositories/add.json') {
        ctx.github.script(11, 'getRepository', '*', { kind: 'ok', repo: { githubId: SHARED_GITHUB_ID, owner: 'darthjee', name: 'kerghan', private: false } });
      }

      const response = await send(ctx, row, ctx.owner);

      expect(response.status).toBe(row.success);
      expectNeverCached(response);
    });

    it('sends X-Skip-Cache and Cache-Control: no-store on a handler error', async () => {
      const failing = row.handlerError(ctx);

      if (failing.status === 0) return; // No handler error is reachable on this route.

      const response = await send(ctx, row, ctx.owner, failing.body);

      expect(response.status).toBe(failing.status);
      expectNeverCached(response);
    });
  });

  describe('repositories routes', () => {
    it.each(REPOSITORY_ROWS.map((row) => [row.path]))('never answers GET %s', async (path) => {
      const response = await call(ctx.app, 'get', path, ctx.owner);

      expect(response.status).toBe(404);
      expect(ctx.repositories.calls).toEqual([]);
    });

    it('answers an intruder-only repo exactly like a missing one on Add', async () => {
      const foreign = await call(ctx.app, 'post', '/repositories/add.json', ctx.owner).send({ githubId: INTRUDER_ONLY_GITHUB_ID });
      const missing = await call(ctx.app, 'post', '/repositories/add.json', ctx.owner).send({ githubId: MISSING_GITHUB_ID });
      const byName = await call(ctx.app, 'post', '/repositories/add.json', ctx.owner).send({ fullName: 'evil/secret' });

      expectErrorBody(foreign, { status: 404, code: ErrorCodes.NOT_FOUND, message: 'Repository not found' });
      expect(withoutTimestamp(foreign.body)).toEqual(withoutTimestamp(missing.body));
      expect(withoutTimestamp(byName.body)).toEqual(withoutTimestamp(missing.body));
      expect(ctx.github.githubCalls()).toEqual([]);
      expect(ctx.repositories.callsOf('markAdded')).toEqual([]);
    });

    it('lists only the caller’s rows, never the intruder’s', async () => {
      const response = await call(ctx.app, 'post', '/repositories/mine.json', ctx.owner).send({}).expect(200);

      expect(response.body.repositories.map((row: { fullName: string }) => row.fullName)).toEqual(['darthjee/kerghan']);
      expect(JSON.stringify(response.body)).not.toContain('evil');
      expectNoForbiddenKeys(response.body);
    });
  });

  describe('admins', () => {
    it('get their own (empty) listing, never another user’s', async () => {
      const response = await call(ctx.app, 'post', '/repositories/mine.json', ctx.admin).send({}).expect(200);

      expect(response.body.repositories).toEqual([]);
      expect(response.body.pagination).toEqual({ page: 1, perPage: 50, total: 0, totalPages: 0 });
      expect(ctx.repositories.calls.every((logged) => logged.userId === ctx.ids.admin)).toBe(true);
    });

    it('cannot add another user’s repository', async () => {
      const response = await call(ctx.app, 'post', '/repositories/add.json', ctx.admin).send({ githubId: SHARED_GITHUB_ID });

      expectErrorBody(response, { status: 404, code: ErrorCodes.NOT_FOUND, message: 'Repository not found' });
      expect(ctx.repositories.rowsOf(ctx.ids.owner)[0].addedAt).toBeNull();
    });

    it('see no repository-derived field nor githubHandle in /admin/users/* responses', async () => {
      ctx.userRepo.rows[0].githubHandle = 'darthjee';

      const response = await call(ctx.app, 'post', '/admin/users/search.json', ctx.admin).send({}).expect(201);
      const text = JSON.stringify(response.body);

      expect(text).not.toMatch(/githubHandle|githubId|repositories|fullName|accessIntegration/);
    });
  });
});
