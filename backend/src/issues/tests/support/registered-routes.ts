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
