import 'reflect-metadata';
import { RequestMethod, type Type } from '@nestjs/common';
import { METHOD_METADATA, MODULE_METADATA, PATH_METADATA } from '@nestjs/common/constants.js';
import { IssuesModule } from '../../issues.module.js';

/** The sample uuid every `:projectId` is replaced by. */
export const PROJECT_ID = '3f2a0000-0000-4000-8000-0000000000c9';
/** The sample uuid every `:issueId` is replaced by. */
export const ISSUE_ID = '3f2a0000-0000-4000-8000-0000000000d1';

/**
 * The controllers the Issues module registers, from its `@Module()` metadata (never a fixed list,
 * so a controller added later is found).
 * @returns {Type[]} The controller classes.
 */
export function issuesControllers(): Type[] {
  return (Reflect.getMetadata(MODULE_METADATA.CONTROLLERS, IssuesModule) as Type[] | undefined) ?? [];
}

/**
 * Every route of every controller of the Issues module, from Nest's decorator metadata.
 * @returns {string[]} `METHOD /path` entries, sorted, the path ids replaced by the sample uuids.
 */
export function registeredRoutes(): string[] {
  return issuesControllers().flatMap(routesOf).sort();
}

/**
 * The routes of one controller.
 * @param {Type} controller - The controller class.
 * @returns {string[]} `METHOD /path` entries.
 */
function routesOf(controller: Type): string[] {
  const prototype = controller.prototype as Record<string, object>;
  const base = (Reflect.getMetadata(PATH_METADATA, controller) as string | undefined) ?? '';

  return Object.getOwnPropertyNames(prototype)
    .filter((name) => name !== 'constructor')
    .filter((name) => Reflect.getMetadata(PATH_METADATA, prototype[name]) !== undefined)
    .map((name) => {
      const method = RequestMethod[Reflect.getMetadata(METHOD_METADATA, prototype[name]) as number];
      const path = `/${base}/${Reflect.getMetadata(PATH_METADATA, prototype[name]) as string}`
        .replace(/\/+/g, '/')
        .replace(':projectId', PROJECT_ID)
        .replace(':issueId', ISSUE_ID);

      return `${method} ${path}`;
    });
}

export type Service = 'projects' | 'issues' | 'links';

/** One row of the route table: every route of the Issues module (`testing.md#security-verification`). */
export interface RouteRow {
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

export const ROUTE_ROWS: RouteRow[] = [
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
  { service: 'issues', path: project('issues/bulk-state.json'), body: { issueIds: [ISSUE_ID], state: 'closed' }, invalidBody: { issueIds: [] }, success: 200, method: 'bulkState' },
  { service: 'issues', path: issue('delete.json'), body: {}, invalidBody: null, success: 200, method: 'delete' },
  { service: 'links', path: project('issues/import.json'), body: { number: 12 }, invalidBody: { number: 'x' }, success: 201, method: 'import' },
  { service: 'links', path: issue('attach.json'), body: { number: 12 }, invalidBody: { number: 'x' }, success: 200, method: 'attach' },
  { service: 'links', path: issue('unlink.json'), body: {}, invalidBody: { discardUnsentChanges: 'x' }, success: 200, method: 'unlink' },
  { service: 'links', path: issue('refresh.json'), body: {}, invalidBody: null, success: 202, method: 'refreshIssue' },
  { service: 'links', path: project('refresh.json'), body: {}, invalidBody: null, success: 202, method: 'refreshProject' },
  { service: 'links', path: issue('retry-sync.json'), body: {}, invalidBody: null, success: 202, method: 'retrySync' },
];

